import type { Figure } from "@/lib/tools/notes/types";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Replace a "{{FIG_n}}" token with a block; append the block if the token is
// missing (so a figure is never silently lost).
function substitute(markdown: string, token: string, block: string): string {
  return markdown.includes(token)
    ? markdown.split(token).join(block)
    : `${markdown}\n\n${block}`;
}

function labelList(labels: string[] | undefined, indent = ""): string {
  if (!labels?.length) return "";
  return "\n" + labels.map((l) => `${indent}- ${l}`).join("\n");
}

/**
 * Clean, text-only markdown for copy/export and the persisted Note: every
 * figure token becomes a "*[Diagram: caption]*" line plus its label key.
 * No base64 — Drive export (v1.5) writes the cropped images separately.
 */
export function toCleanMarkdown(
  markdown: string,
  figures: Figure[] | undefined,
): string {
  let out = markdown;
  for (const fig of figures ?? []) {
    out = substitute(
      out,
      fig.token,
      `*[Diagram: ${fig.caption}]*${labelList(fig.labels)}`,
    );
  }
  return out;
}

// Crop a figure's region out of the source bitmap onto a canvas. Returns null
// when the region is degenerate (too small). Shared by the data-URL (display)
// and Blob (save) producers below.
function cropCanvas(
  bitmap: ImageBitmap,
  box: Figure["box"],
): HTMLCanvasElement | null {
  const W = bitmap.width;
  const H = bitmap.height;

  // Some models (e.g. Gemini) return coordinates scaled 0..1000 instead of
  // 0..1. Detect that and bring them back into the unit range.
  const scale =
    Math.max(box.x0, box.y0, box.x1, box.y1) > 1.5 ? 1 / 1000 : 1;
  let x0 = clamp01(Math.min(box.x0, box.x1) * scale);
  let y0 = clamp01(Math.min(box.y0, box.y1) * scale);
  let x1 = clamp01(Math.max(box.x0, box.x1) * scale);
  let y1 = clamp01(Math.max(box.y0, box.y1) * scale);

  // Pad ~3% on each side to forgive loose model bounding boxes.
  const padX = (x1 - x0) * 0.03;
  const padY = (y1 - y0) * 0.03;
  x0 = clamp01(x0 - padX);
  y0 = clamp01(y0 - padY);
  x1 = clamp01(x1 + padX);
  y1 = clamp01(y1 + padY);

  const sx = Math.round(x0 * W);
  const sy = Math.round(y0 * H);
  const sw = Math.round((x1 - x0) * W);
  const sh = Math.round((y1 - y0) * H);
  if (sw < 8 || sh < 8) return null;

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

function cropToDataUrl(bitmap: ImageBitmap, box: Figure["box"]): string | null {
  const canvas = cropCanvas(bitmap, box);
  return canvas ? canvas.toDataURL("image/jpeg", 0.85) : null;
}

function cropToBlob(
  bitmap: ImageBitmap,
  box: Figure["box"],
): Promise<Blob | null> {
  const canvas = cropCanvas(bitmap, box);
  if (!canvas) return Promise.resolve(null);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85),
  );
}

const escapeAlt = (s: string) => s.replace(/[[\]\n]/g, " ").trim();

/**
 * Display markdown: crops each figure region out of the original image (via
 * canvas) and inlines it as a data-URL image, with caption + label key beneath.
 * Falls back to the clean text block if a crop can't be produced.
 */
export async function toDisplayMarkdown(
  file: File,
  markdown: string,
  figures: Figure[] | undefined,
): Promise<string> {
  if (!figures?.length) return markdown;

  let bitmap: ImageBitmap;
  try {
    // from-image so the canvas matches the EXIF-oriented preview the user sees.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return toCleanMarkdown(markdown, figures);
  }

  let out = markdown;
  for (const fig of figures) {
    const url = cropToDataUrl(bitmap, fig.box);
    const block = url
      ? `![${escapeAlt(fig.caption)}](${url})\n\n*${fig.caption}*${labelList(fig.labels)}`
      : `*[Diagram: ${fig.caption}]*${labelList(fig.labels)}`;
    out = substitute(out, fig.token, block);
  }
  bitmap.close?.();
  return out;
}

/**
 * Crops each figure region out of the original image as a JPEG Blob, keyed by
 * the figure's token. Used when saving a note so the crops can be uploaded to
 * Storage. Figures whose region can't be cropped are simply omitted.
 */
export async function cropFiguresToBlobs(
  file: File,
  figures: Figure[] | undefined,
): Promise<Map<string, Blob>> {
  const result = new Map<string, Blob>();
  if (!figures?.length) return result;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return result;
  }

  for (const fig of figures) {
    const blob = await cropToBlob(bitmap, fig.box);
    if (blob) result.set(fig.token, blob);
  }
  bitmap.close?.();
  return result;
}
