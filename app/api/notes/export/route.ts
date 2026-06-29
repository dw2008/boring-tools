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
  notebook: string;
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

// Group notes by notebook, notebooks sorted, order within a group preserved.
function groupByNotebook(notes: NoteRow[]): [string, NoteRow[]][] {
  const groups = new Map<string, NoteRow[]>();
  for (const note of notes) {
    if (!groups.has(note.notebook)) groups.set(note.notebook, []);
    groups.get(note.notebook)!.push(note);
  }
  return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
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
  .notebook-heading {
    break-before: page; font-size: 22px; margin: 0 0 4px;
    padding-bottom: 6px; border-bottom: 2px solid #18181b;
  }
  .notebook-heading:first-of-type { break-before: avoid; }
  .note { break-before: page; padding-top: 8px; }
  .note.first-in-group { break-before: avoid; }
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
  heading: string,
  stamp: string,
): Promise<string> {
  const groups = groupByNotebook(notes);
  const showNotebookHeadings = groups.length > 1;
  const sections: string[] = [];

  for (const [notebook, groupNotes] of groups) {
    if (showNotebookHeadings) {
      sections.push(
        `<h2 class="notebook-heading">${escapeHtml(notebook)}</h2>`,
      );
    }

    for (let i = 0; i < groupNotes.length; i++) {
      const note = groupNotes[i];
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
        `<section class="note${i === 0 ? " first-in-group" : ""}">
          <h3 class="note-title">${escapeHtml(note.title)}</h3>
          <p class="note-meta">${formatDate(note.created_at)}</p>
          <div class="body">${renderBody(note.markdown)}</div>
          ${figureHtml.length ? `<div class="figures">${figureHtml.join("\n")}</div>` : ""}
        </section>`,
      );
    }
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(heading)} — boringtools</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="toolbar">
    <span class="t">Use “Save as PDF” as the destination in the print dialog.</span>
    <button onclick="window.print()">Save as PDF</button>
  </div>
  <h1>${escapeHtml(heading)}</h1>
  <p class="doc-meta">Exported ${stamp} · ${notes.length} note${notes.length > 1 ? "s" : ""}</p>
  ${sections.join("\n")}
</body>
</html>`;
}

/* ---------- ZIP (markdown + image files, grouped by notebook) ---------- */

async function buildZip(
  supabase: SupabaseClient,
  notes: NoteRow[],
  stamp: string,
): Promise<Buffer> {
  const zip = new JSZip();
  const root = zip.folder(`boringtools-notes-${stamp}`)!;
  const groups = groupByNotebook(notes);

  for (const [notebook, groupNotes] of groups) {
    const notebookFolder = root.folder(slugify(notebook))!;

    for (let i = 0; i < groupNotes.length; i++) {
      const note = groupNotes[i];
      const folder = notebookFolder.folder(
        `${String(i + 1).padStart(2, "0")}-${slugify(note.title)}`,
      )!;
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
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

/* ---------- handler ---------- */

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const format = params.get("format") ?? "zip";
    const notebookFilter = params.get("notebook");
    const noteFilter = params.get("note");

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

    let query = supabase
      .from("notes")
      .select("id, title, markdown, figures, notebook, created_at")
      .eq("user_id", user.id);

    // Scope: a single note, a single notebook, or everything.
    if (noteFilter) query = query.eq("id", noteFilter);
    else if (notebookFilter) query = query.eq("notebook", notebookFilter);

    const { data: rows, error: listError } = await query.order("created_at", {
      ascending: false,
    });

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
        { error: "Nothing to export." },
        { status: 400 },
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);

    // Scope label drives the document heading and download filename.
    let heading = "My Notes";
    let baseName = "notes";
    if (noteFilter) {
      heading = notes[0].title;
      baseName = slugify(notes[0].title);
    } else if (notebookFilter) {
      heading = notebookFilter;
      baseName = slugify(notebookFilter);
    }

    if (format === "html") {
      const html = await buildHtml(supabase, notes, heading, stamp);
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
        "Content-Disposition": `attachment; filename="boringtools-${baseName}-${stamp}.zip"`,
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
