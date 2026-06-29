import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Figure } from "@/lib/tools/notes/types";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to delete notes." },
        { status: 401 },
      );
    }

    // Fetch the note first (RLS confines this to the owner) so we know which
    // Storage objects to clean up. Missing row → 404.
    const { data: row, error: fetchError } = await supabase
      .from("notes")
      .select("id, figures")
      .eq("id", id)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }

    // Remove the figure images from Storage (best-effort — a failure here
    // shouldn't block deleting the row).
    const paths = ((row.figures as Figure[]) ?? [])
      .map((f) => f.imagePath)
      .filter((p): p is string => Boolean(p));

    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage
        .from("note-figures")
        .remove(paths);
      if (removeError) {
        console.error("Figure cleanup error:", removeError);
      }
    }

    const { error: deleteError } = await supabase
      .from("notes")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Note delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete note. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Note delete API error:", err);
    return NextResponse.json(
      { error: "Failed to delete note. Please try again." },
      { status: 500 },
    );
  }
}
