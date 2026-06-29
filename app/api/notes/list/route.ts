import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NOTE_LIBRARY_LIMITS } from "@/lib/stripe/plans";
import type {
  Figure,
  NotesListResponse,
  SavedNote,
} from "@/lib/tools/notes/types";

const SIGNED_URL_TTL = 60 * 60; // 1 hour

// Infinity → null so it survives JSON serialization.
const finiteOrNull = (n: number) => (Number.isFinite(n) ? n : null);

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to view your notes." },
        { status: 401 },
      );
    }

    // 1. Fetch the user's notes (RLS confines this to their own rows).
    const { data: rows, error: listError } = await supabase
      .from("notes")
      .select("id, title, markdown, figures, topic, notebook, size_bytes, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (listError) {
      console.error("Notes list error:", listError);
      return NextResponse.json(
        { error: "Failed to load your notes. Please try again." },
        { status: 500 },
      );
    }

    const noteRows = rows ?? [];

    // 2. Batch-sign every figure image path so the private bucket can render.
    const allPaths = noteRows.flatMap((row) =>
      ((row.figures as Figure[]) ?? [])
        .map((f) => f.imagePath)
        .filter((p): p is string => Boolean(p)),
    );

    const urlByPath = new Map<string, string>();
    if (allPaths.length > 0) {
      const { data: signed } = await supabase.storage
        .from("note-figures")
        .createSignedUrls(allPaths, SIGNED_URL_TTL);

      for (const item of signed ?? []) {
        if (item.signedUrl && item.path) urlByPath.set(item.path, item.signedUrl);
      }
    }

    const notes: SavedNote[] = noteRows.map((row) => {
      const figures = ((row.figures as Figure[]) ?? []).map((f) => ({
        ...f,
        imageUrl: f.imagePath ? urlByPath.get(f.imagePath) : undefined,
      }));
      return {
        id: row.id,
        title: row.title,
        markdown: row.markdown,
        figures,
        topic: row.topic ?? undefined,
        notebook: row.notebook ?? "Unsorted",
        createdAt: row.created_at,
        sizeBytes: row.size_bytes ?? 0,
      };
    });

    // 3. Usage + caps for the meter.
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    const userPlan = profile?.subscription_tier ?? "free";
    const caps = NOTE_LIBRARY_LIMITS[userPlan] ?? NOTE_LIBRARY_LIMITS.free;
    const usedBytes = notes.reduce((sum, n) => sum + n.sizeBytes, 0);

    const response: NotesListResponse = {
      notes,
      usage: {
        savedNotes: notes.length,
        savedNotesCap: finiteOrNull(caps.savedNotes),
        usedBytes,
        storageBytesCap: finiteOrNull(caps.storageBytes),
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Notes list API error:", err);
    return NextResponse.json(
      { error: "Failed to load your notes. Please try again." },
      { status: 500 },
    );
  }
}
