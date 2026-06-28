# Note Digitizer — BoringTools Spec

A stripped-down, in-character version of the AI Note-Taking Assistant PRD, scoped to fit BoringTools and built so cloud storage drops in cleanly later.

## What it is

Upload (or snap) a photo of a physical book page or handwritten notes, get clean, structured Markdown back. Copy it out, or — once storage is wired — save it to your own Google Drive. No accounts you have to own, no server holding user data.

This keeps the "open it, use it, close it" character of the proofreader and interview prepper, while reusing your existing AI-wrapper pattern almost verbatim. The only genuinely new primitive is image input.

## Scope decisions (and what got cut from the PRD)

The original PRD is a full product vision. This trims it to what fits the site:

- **Kept:** image capture, OCR + handwriting extraction, Markdown generation, original-image-as-reference fallback, cloud storage via Google Drive.
- **Cut for now:** automatic contextual chapter/topic inference (nice-to-have, not core), generative diagram *recreation* (the PRD itself makes this optional — keep the original image instead), in-app archive browsing UI.
- **Deferred:** the archive/search experience. v1 produces and exports; browsing your saved notes is a later concern once Drive holds them.

The cut isn't a failure to meet spec — it's treating the PRD as a menu, picking what fits, and sequencing the rest.

## Build phases

**v1 — Image to Markdown (no persistence).** Upload image → vision model extracts highlighted text and handwritten notes → returns structured Markdown → rendered in a viewer with a copy button. Notes are discarded on refresh. This is mechanically your existing text wrapper plus one new input type.

**v1.5 — Google Drive export.** Add an OAuth flow so the user authenticates with their own Google account, and a "Save to Drive" button that writes the Markdown file into their Drive. Because the file lands in *their* Drive, you don't run a database, own accounts, or hold anyone's data. This is the PRD's cloud-storage requirement, satisfied via the lighter of the two cloud paths.

**v2 (only if used) — Archive + browse.** If people actually use it enough to want their notes across sessions and devices, add listing/searching of previously saved notes. Don't build this on speculation.

## Data model (the part that makes storage a drop-in)

Even in v1 where notes are discarded, structure each processed note as a clean object from day one. This is what makes the Drive write a clean addition rather than a rewrite — the shape of the data carries across the gap.

```ts
interface Note {
  id: string;            // uuid, generated client-side
  title: string;         // inferred from content, or first line / filename
  markdown: string;      // the structured note body
  topic?: string;        // optional inferred topic/chapter; omit in v1
  sourceImageRef?: string; // for the "keep original as reference" fallback
  createdAt: string;     // ISO timestamp
}
```

v1 renders this object and throws it away. v1.5 serializes `markdown` to a `.md` file in Drive (with `title` as the filename, `createdAt` for ordering). v2 lists them. Same object throughout.

## Processing pipeline (v1)

1. User uploads or captures an image (JPEG/PNG).
2. Client base64-encodes it and sends it to the vision model in a single multimodal call — same call pattern as the existing tools, with an image block added.
3. Prompt instructs the model to: separate highlighted/printed text from handwritten marginalia, structure the result as Markdown (headings, bullets, blockquotes for highlights), and note any diagrams present.
4. For diagrams/figures: do **not** attempt generative recreation in v1. Keep a reference to the original image and embed/link it in the Markdown (the PRD's own fallback).
5. Return the assembled `Note` object; render `markdown` in the viewer.

## Google Drive integration (v1.5)

- **Auth:** Google OAuth 2.0, requesting the `drive.file` scope (access only to files your app creates — minimal, not full-Drive access). The user consents with their own Google account.
- **Write:** On "Save to Drive," call the Drive Files API to create a `.md` file with the note's `markdown` as content and `title` as the name. Optionally write the source image alongside it if the reference fallback was used.
- **You hold nothing.** No backend persistence, no user database. The user brings their own storage; Google handles auth, storage, and liability.

## Known caveats (so nothing surprises you)

- **Handwriting quality varies.** Printed and highlighted book text extracts very cleanly. Messy handwritten marginalia is hit-or-miss depending on the handwriting. This is an output-quality expectation, not a build-difficulty issue — but tell users their results will be best with clear handwriting.
- **OAuth won't work in an artifact preview.** If you prototype the v1 core as a Claude artifact, real OAuth and browser storage won't run there — prototype the image-to-Markdown loop in-memory, then wire the Drive flow in your actual deployment.
- **`drive.file` scope is the gentle one.** Avoid requesting broad Drive scopes; `drive.file` keeps the consent screen low-friction and the permissions honest.

## UI (in BoringTools style)

- A prominent upload/capture button (centered, single clear action).
- Processing states: "Processing…" → rendered result.
- A clean Markdown viewer with a copy button.
- v1.5 adds a single "Save to Drive" button next to copy.
- A small note about handwriting quality near the upload control sets expectations honestly.
