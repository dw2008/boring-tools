import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NOTE_LIBRARY_LIMITS } from "@/lib/stripe/plans";
import type { Figure, Note, SaveNoteResponse } from "@/lib/tools/notes/types";

const MAX_FIGURE_BYTES = 5 * 1024 * 1024; // per cropped figure
const MAX_TOTAL_FIGURE_BYTES = 25 * 1024 * 1024; // per saved note
const FIGURE_FIELD_PREFIX = "figure:";

const figureMetaSchema = z.object({
  token: z.string(),
  caption: z.string(),
  labels: z.array(z.string()),
  box: z.object({
    x0: z.number(),
    y0: z.number(),
    x1: z.number(),
    y1: z.number(),
  }),
});

const saveSchema = z.object({
  title: z.string().min(1).max(120),
  markdown: z.string().min(1).max(100_000),
  topic: z.string().max(120).optional(),
  notebook: z.string().trim().max(60).optional(),
  figures: z.array(figureMetaSchema).default([]),
});

// "{{FIG_1}}" -> "fig_1"; prefixed with the index to guarantee a unique path.
function figureSlug(token: string, index: number): string {
  const base = token
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `${index}_${base || "fig"}`;
}

export async function POST(request: Request) {
  try {
    // 1. Parse multipart form
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Expected multipart/form-data." },
        { status: 400 },
      );
    }

    const rawNote = formData.get("note");
    if (typeof rawNote !== "string") {
      return NextResponse.json(
        { error: "Missing note payload." },
        { status: 400 },
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawNote);
    } catch {
      return NextResponse.json(
        { error: "Note payload is not valid JSON." },
        { status: 400 },
      );
    }

    const parsed = saveSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    // 2. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to save notes." },
        { status: 401 },
      );
    }

    // 3. Collect + validate the figure image files (one per figure token)
    const { title, markdown, topic, notebook, figures } = parsed.data;
    const notebookName = notebook?.trim() || "Unsorted";
    const fileByToken = new Map<string, File>();
    let incomingBytes = 0;

    for (const fig of figures) {
      const field = formData.get(`${FIGURE_FIELD_PREFIX}${fig.token}`);
      if (!(field instanceof File)) continue; // figure with no crop — kept as text

      if (field.type !== "image/jpeg") {
        return NextResponse.json(
          { error: "Figure images must be JPEG." },
          { status: 400 },
        );
      }
      if (field.size > MAX_FIGURE_BYTES) {
        return NextResponse.json(
          { error: "A figure image exceeds the size limit." },
          { status: 400 },
        );
      }
      incomingBytes += field.size;
      fileByToken.set(fig.token, field);
    }

    if (incomingBytes > MAX_TOTAL_FIGURE_BYTES) {
      return NextResponse.json(
        { error: "This note's figures exceed the per-note size limit." },
        { status: 400 },
      );
    }

    // 4. Look up plan + enforce library caps (note count AND storage bytes)
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    const userPlan = profile?.subscription_tier ?? "free";
    const caps = NOTE_LIBRARY_LIMITS[userPlan] ?? NOTE_LIBRARY_LIMITS.free;

    const { count: noteCount, error: countError } = await admin
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      console.error("Note count error:", countError);
      return NextResponse.json(
        { error: "Failed to check your saved notes. Please try again." },
        { status: 500 },
      );
    }

    if ((noteCount ?? 0) >= caps.savedNotes) {
      return NextResponse.json(
        {
          error: `You've reached your saved-notes limit of ${caps.savedNotes}. Delete a note or upgrade your plan.`,
          code: "LIMIT_REACHED",
        },
        { status: 403 },
      );
    }

    const { data: sizeRows, error: sizeError } = await admin
      .from("notes")
      .select("size_bytes")
      .eq("user_id", user.id);

    if (sizeError) {
      console.error("Storage usage error:", sizeError);
      return NextResponse.json(
        { error: "Failed to check your storage usage. Please try again." },
        { status: 500 },
      );
    }

    const usedBytes = (sizeRows ?? []).reduce(
      (sum, row) => sum + (row.size_bytes ?? 0),
      0,
    );

    if (usedBytes + incomingBytes > caps.storageBytes) {
      return NextResponse.json(
        {
          error:
            "Saving this note would exceed your storage limit. Delete a note or upgrade your plan.",
          code: "STORAGE_FULL",
        },
        { status: 403 },
      );
    }

    // 5. Upload figure crops to Storage, recording the path on each figure.
    //    User-scoped client → storage RLS confines writes to the user's folder.
    const noteId = randomUUID();
    const uploadedPaths: string[] = [];
    const storedFigures: Figure[] = [];

    for (let i = 0; i < figures.length; i++) {
      const fig = figures[i];
      const file = fileByToken.get(fig.token);
      if (!file) {
        storedFigures.push(fig); // no crop — keep metadata only
        continue;
      }

      const path = `${user.id}/${noteId}/${figureSlug(fig.token, i)}.jpg`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from("note-figures")
        .upload(path, buffer, { contentType: "image/jpeg", upsert: false });

      if (uploadError) {
        console.error("Figure upload error:", uploadError);
        // Roll back any objects already uploaded for this note.
        if (uploadedPaths.length > 0) {
          await supabase.storage.from("note-figures").remove(uploadedPaths);
        }
        return NextResponse.json(
          { error: "Failed to store figure images. Please try again." },
          { status: 500 },
        );
      }

      uploadedPaths.push(path);
      storedFigures.push({ ...fig, imagePath: path });
    }

    // 6. Insert the note row (RLS enforces user_id = auth.uid())
    const { data: inserted, error: insertError } = await supabase
      .from("notes")
      .insert({
        id: noteId,
        user_id: user.id,
        title,
        markdown,
        figures: storedFigures,
        topic: topic ?? null,
        notebook: notebookName,
        size_bytes: incomingBytes,
      })
      .select("id, title, markdown, figures, topic, notebook, created_at")
      .single();

    if (insertError || !inserted) {
      console.error("Note insert error:", insertError);
      // Don't leave orphaned figure objects behind.
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("note-figures").remove(uploadedPaths);
      }
      return NextResponse.json(
        { error: "Failed to save note. Please try again." },
        { status: 500 },
      );
    }

    const note: Note = {
      id: inserted.id,
      title: inserted.title,
      markdown: inserted.markdown,
      figures: (inserted.figures as Figure[]) ?? [],
      topic: inserted.topic ?? undefined,
      createdAt: inserted.created_at,
    };

    const response: SaveNoteResponse = { note };
    return NextResponse.json(response);
  } catch (err) {
    console.error("Save note API error:", err);
    return NextResponse.json(
      { error: "Failed to save note. Please try again." },
      { status: 500 },
    );
  }
}
