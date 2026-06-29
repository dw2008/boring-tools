import { NextResponse } from "next/server";
import { marked } from "marked";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Figure } from "@/lib/tools/notes/types";

interface NoteRow {
  id: string;
  title: string;
  markdown: string;
  figures: Figure[];
  created_at: string;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "note"
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const escapeAlt = (s: string) => s.replace(/[[\]\n]/g, " ").trim();

async function figureBytes(
  supabase: SupabaseClient,
  path: string,
): Promise<Buffer | null> {
  const { data: blob, error } = await supabase.storage
    .from("note-figures")
    .download(path);
  if (error || !blob) return null;
  return Buffer.from(await blob.arrayBuffer());
}

/* ---------- HTML (print → Save as PDF) ---------- */

const PRINT_STYLES = `
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #14181d; line-height: 1.5; margin: 0 auto; max-width: 760px;
    padding: 28px 24px;
  }
  .toolbar {
    position: sticky; top: 0; display: flex; justify-content: space-between;
    align-items: center; gap: 12px; padding: 10px 14px; margin: -28px -24px 24px;
    background: #f6f6f7; border-bottom: 1px solid #e4e4e7;
    font-family: ui-sans-serif, -apple-system, system-ui, sans-serif;
  }
  .toolbar .t { font-size: 13px; color: #71717a; }
  .toolbar button {
    font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
    background: #18181b; color: #fafafa; border: none; border-radius: 8px;
    padding: 8px 16px;
  }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .doc-meta { color: #71717a; font-size: 13px; margin: 0 0 8px;
    font-family: ui-sans-serif, system-ui, sans-serif; }
  .note { break-before: page; padding-top: 8px; }
  .note:first-of-type { break-before: avoid; }
  .note-title { font-size: 21px; margin: 0 0 2px; border-bottom: 1px solid #e4e4e7; padding-bottom: 6px; }
  .note-meta { color: #71717a; font-size: 12px; margin: 0 0 14px;
    font-family: ui-sans-serif, system-ui, sans-serif; }
  .body h1 { font-size: 20px; } .body h2 { font-size: 17px; } .body h3 { font-size: 15px; }
  .body h1, .body h2, .body h3 { break-after: avoid; margin: 14px 0 6px; }
  .body p { margin: 0 0 10px; }
  .body ul, .body ol { padding-left: 22px; margin: 0 0 10px; }
  .body li { margin: 3px 0; }
  .body blockquote { border-left: 3px solid #d4d4d8; margin: 0 0 10px; padding-left: 12px; color: #52525b; font-style: italic; }
  .figures { margin-top: 16px; }
  figure { break-inside: avoid; margin: 0 0 14px; }
  figure img { max-width: 100%; height: auto; border: 1px solid #e4e4e7; border-radius: 6px; display: block; }
  figcaption { font-size: 12px; color: #52525b; margin-top: 4px;
    font-family: ui-sans-serif, system-ui, sans-serif; }
  @media print {
    .toolbar { display: none; }
    body { padding: 0; max-width: none; }
  }
`;

function renderBody(markdown: string): string {
  return marked.parse(markdown ?? "", { async: false });
}

async function buildHtml(
  supabase: SupabaseClient,
  notes: NoteRow[],
  stamp: string,
): Promise<string> {
  const sections: string[] = [];

  for (const note of notes) {
    const figures = (note.figures ?? []).filter((f) => f.imagePath);
    const figureHtml: string[] = [];

    for (const fig of figures) {
      const bytes = await figureBytes(supabase, fig.imagePath!);
      if (!bytes) continue;
      const src = `data:image/jpeg;base64,${bytes.toString("base64")}`;
      figureHtml.push(
        `<figure><img src="${src}" alt="${escapeHtml(escapeAlt(fig.caption))}" /><figcaption>${escapeHtml(fig.caption)}</figcaption></figure>`,
      );
    }

    sections.push(
      `<section class="note">
        <h2 class="note-title">${escapeHtml(note.title)}</h2>
        <p class="note-meta">${formatDate(note.created_at)}</p>
        <div class="body">${renderBody(note.markdown)}</div>
        ${figureHtml.length ? `<div class="figures">${figureHtml.join("\n")}</div>` : ""}
      </section>`,
    );
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>My Notes — boringtools</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="toolbar">
    <span class="t">Use “Save as PDF” as the destination in the print dialog.</span>
    <button onclick="window.print()">Save as PDF</button>
  </div>
  <h1>My Notes</h1>
  <p class="doc-meta">Exported ${stamp} · ${notes.length} note${notes.length > 1 ? "s" : ""}</p>
  ${sections.join("\n")}
</body>
</html>`;
}

/* ---------- ZIP (markdown + image files) ---------- */

async function buildZip(
  supabase: SupabaseClient,
  notes: NoteRow[],
  stamp: string,
): Promise<Buffer> {
  const zip = new JSZip();
  const root = zip.folder(`boringtools-notes-${stamp}`)!;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const folderName = `${String(i + 1).padStart(2, "0")}-${slugify(note.title)}`;
    const folder = root.folder(folderName)!;
    const figures = (note.figures ?? []).filter((f) => f.imagePath);

    let md = `# ${note.title}\n\n*${formatDate(note.created_at)}*\n\n${(note.markdown ?? "").trim()}\n`;

    if (figures.length > 0) {
      md += `\n## Figures\n\n`;
      for (let j = 0; j < figures.length; j++) {
        const fig = figures[j];
        const fileName = `${j}.jpg`;
        md += `![${escapeAlt(fig.caption)}](figures/${fileName})\n\n*${fig.caption}*\n\n`;
        const bytes = await figureBytes(supabase, fig.imagePath!);
        if (bytes) folder.folder("figures")!.file(fileName, bytes);
      }
    }

    folder.file("note.md", md);
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

/* ---------- handler ---------- */

export async function GET(request: Request) {
  try {
    const format = new URL(request.url).searchParams.get("format") ?? "zip";

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to export your notes." },
        { status: 401 },
      );
    }

    const { data: rows, error: listError } = await supabase
      .from("notes")
      .select("id, title, markdown, figures, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (listError) {
      console.error("Export list error:", listError);
      return NextResponse.json(
        { error: "Failed to export your notes. Please try again." },
        { status: 500 },
      );
    }

    const notes = (rows ?? []) as NoteRow[];
    if (notes.length === 0) {
      return NextResponse.json(
        { error: "You have no saved notes to export." },
        { status: 400 },
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "html") {
      const html = await buildHtml(supabase, notes, stamp);
      // Inline so it opens in a tab ready to "Save as PDF".
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = await buildZip(supabase, notes, stamp);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="boringtools-notes-${stamp}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Notes export API error:", err);
    return NextResponse.json(
      { error: "Failed to export your notes. Please try again." },
      { status: 500 },
    );
  }
}
