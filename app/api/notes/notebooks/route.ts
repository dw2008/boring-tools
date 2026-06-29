import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Returns the user's distinct notebook names (for save-time and library
// pickers). RLS confines the query to the user's own notes.
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ notebooks: [] });
    }

    const { data, error } = await supabase
      .from("notes")
      .select("notebook")
      .eq("user_id", user.id);

    if (error) {
      console.error("Notebooks list error:", error);
      return NextResponse.json({ notebooks: [] });
    }

    const notebooks = Array.from(
      new Set((data ?? []).map((r) => r.notebook as string)),
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ notebooks });
  } catch (err) {
    console.error("Notebooks API error:", err);
    return NextResponse.json({ notebooks: [] });
  }
}
