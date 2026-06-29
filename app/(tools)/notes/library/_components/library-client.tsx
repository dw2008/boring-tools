"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  Trash2,
  Loader2,
  ScanLine,
  FileText,
  Copy,
  Check,
  ChevronLeft,
  Download,
  Printer,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import type { NotesListResponse, SavedNote } from "@/lib/tools/notes/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function figureMeta(note: SavedNote): string {
  const count = note.figures.filter((f) => f.imageUrl).length;
  const figs = count > 0 ? `${count} figure${count > 1 ? "s" : ""}` : "text only";
  return `${figs} · ${formatBytes(note.sizeBytes)}`;
}

/* ---------- left pane: scrollable list ---------- */

function NoteListRow({
  note,
  active,
  onSelect,
}: {
  note: SavedNote;
  active: boolean;
  onSelect: () => void;
}) {
  const thumb = note.figures.find((f) => f.imageUrl)?.imageUrl;
  return (
    <button
      onClick={onSelect}
      aria-current={active}
      className={`flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-colors ${
        active
          ? "border-foreground/20 bg-muted"
          : "border-transparent hover:bg-muted/60"
      }`}
    >
      <div className="h-11 w-11 flex-none overflow-hidden rounded-md border bg-muted">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <FileText className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{note.title}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatDate(note.createdAt)} · {figureMeta(note)}
        </div>
      </div>
    </button>
  );
}

/* ---------- right pane: opened note ---------- */

function NoteDetail({
  note,
  notebooks,
  onMove,
  moving,
  onDelete,
  deleting,
}: {
  note: SavedNote;
  notebooks: string[];
  onMove: (id: string, notebook: string) => void;
  moving: boolean;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [moveTo, setMoveTo] = useState(note.notebook);
  const [newMode, setNewMode] = useState(false);
  const [newName, setNewName] = useState("");
  const figures = note.figures.filter((f) => f.imageUrl);

  const target = (newMode ? newName : moveTo).trim();
  const canMove = !moving && target.length > 0 && target !== note.notebook;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(note.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{note.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(note.createdAt)} · {figureMeta(note)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Notebook</span>
            {newMode ? (
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New notebook name"
                className="h-7 w-44 rounded-md border bg-background px-2 text-xs"
              />
            ) : (
              <select
                value={moveTo}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setNewMode(true);
                    setNewName("");
                  } else {
                    setMoveTo(e.target.value);
                  }
                }}
                className="h-7 rounded-md border bg-background px-2 text-xs"
              >
                {notebooks.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value="__new__">+ New notebook…</option>
              </select>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={!canMove}
              onClick={() => onMove(note.id, target)}
            >
              {moving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Move"}
            </Button>
            {newMode && (
              <button
                type="button"
                onClick={() => setNewMode(false)}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                cancel
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                `/api/notes/export?format=html&note=${note.id}`,
                "_blank",
              )
            }
            title="Save this note as a PDF"
          >
            <Printer className="mr-2 h-4 w-4" />
            Save as PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            title="Copy this note's Markdown text to your clipboard"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Markdown
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(note.id)}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>
      <div className="p-5 text-sm">
        <div className="prose-sm max-w-none [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1 [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:mb-2 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/40 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground">
          <ReactMarkdown>{note.markdown}</ReactMarkdown>
        </div>
        {figures.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {figures.map((f, i) => (
              <figure key={i} className="m-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.imageUrl}
                  alt={f.caption}
                  className="w-full rounded-md border bg-muted"
                />
                <figcaption className="mt-1 text-[11px] text-muted-foreground">
                  {f.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- container ---------- */

export function LibraryClient() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NotesListResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("All");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  // On mobile the list and detail are separate views; this toggles between
  // them. On md+ both panes are always visible and this is ignored.
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/notes/list");
      if (!res.ok) {
        if (res.status === 401) {
          setStatus("ready");
          setData(null);
          return;
        }
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load your notes.");
      }
      const json = (await res.json()) as NotesListResponse;
      setData(json);
      setSelectedId((prev) => prev ?? json.notes[0]?.id ?? null);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your notes.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (user) load();
    else setStatus("ready");
  }, [user, load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete note.");
      }
      setData((prev) => {
        if (!prev) return prev;
        const removed = prev.notes.find((n) => n.id === id);
        const remaining = prev.notes.filter((n) => n.id !== id);
        setSelectedId((cur) => (cur === id ? remaining[0]?.id ?? null : cur));
        if (remaining.length === 0) setMobileDetailOpen(false);
        return {
          notes: remaining,
          usage: {
            ...prev.usage,
            savedNotes: prev.usage.savedNotes - 1,
            usedBytes: prev.usage.usedBytes - (removed?.sizeBytes ?? 0),
          },
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleMove = async (id: string, notebook: string) => {
    setMovingId(id);
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebook }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to move note.");
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              notes: prev.notes.map((n) =>
                n.id === id ? { ...n, notebook } : n,
              ),
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move note.");
    } finally {
      setMovingId(null);
    }
  };

  const header = (
    <div className="space-y-2">
      <h2 className="text-3xl font-bold tracking-tight">My Notes</h2>
      <p className="text-muted-foreground">
        Your saved digitized notes.{" "}
        <Link href="/notes" className="underline hover:text-foreground">
          Digitize a new one →
        </Link>
      </p>
    </div>
  );

  if (!user) {
    return (
      <>
        {header}
        <p className="text-sm text-muted-foreground">
          <button
            onClick={() => setAuthModalOpen(true)}
            className="underline hover:text-foreground transition-colors"
          >
            Sign in
          </button>{" "}
          to view your saved notes.
        </p>
        <AuthModal
          open={authModalOpen}
          onOpenChange={setAuthModalOpen}
          trigger="manual"
        />
      </>
    );
  }

  // Tabs = "All" + the distinct notebooks across the user's notes.
  const notebooks = data
    ? Array.from(new Set(data.notes.map((n) => n.notebook))).sort((a, b) =>
        a.localeCompare(b),
      )
    : [];
  const effectiveTab =
    activeTab !== "All" && notebooks.includes(activeTab) ? activeTab : "All";
  const visibleNotes = data
    ? effectiveTab === "All"
      ? data.notes
      : data.notes.filter((n) => n.notebook === effectiveTab)
    : [];
  const selected =
    visibleNotes.find((n) => n.id === selectedId) ?? visibleNotes[0] ?? null;

  // Export scope follows the active tab: "All" → everything, else that notebook.
  const scopeQuery =
    effectiveTab === "All" ? "" : `&notebook=${encodeURIComponent(effectiveTab)}`;
  const scopeLabel =
    effectiveTab === "All" ? "all notes" : `the “${effectiveTab}” notebook`;

  return (
    <>
      {header}

      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your notes…
        </div>
      )}

      {status === "error" && (
        <div className="space-y-3 text-sm">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      )}

      {status === "ready" && data && data.notes.length === 0 && (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <ScanLine className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No saved notes yet.</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/notes">Digitize a note</Link>
          </Button>
        </div>
      )}

      {status === "ready" && data && data.notes.length > 0 && (
        <div className="space-y-4">
          {/* Notebook tabs + export scoped to the active tab */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
              {["All", ...notebooks].map((tab) => {
                const count =
                  tab === "All"
                    ? data.notes.length
                    : data.notes.filter((n) => n.notebook === tab).length;
                const isActive = effectiveTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-none rounded-full border px-3 py-1 text-sm transition-colors ${
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {tab}
                    <span className="ml-1.5 text-xs opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-none items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/notes/export?format=html${scopeQuery}`, "_blank")}
                title={`Save ${scopeLabel} as a PDF`}
              >
                <Printer className="mr-2 h-4 w-4" />
                Save as PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = `/api/notes/export?format=zip${scopeQuery}`;
                }}
                title={`Download ${scopeLabel} as a ZIP`}
              >
                <Download className="mr-2 h-4 w-4" />
                Export ZIP
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {/* Left: scrollable list. On mobile, hidden while a note is open. */}
            <aside
              className={`${
                mobileDetailOpen ? "hidden md:block" : "block"
              } md:w-72 md:flex-none lg:w-80`}
            >
              <UsageMeter usage={data.usage} />
              <div className="mt-3 space-y-1 md:max-h-[calc(100vh-260px)] md:overflow-y-auto md:pr-1">
                {visibleNotes.map((note) => (
                  <NoteListRow
                    key={note.id}
                    note={note}
                    active={note.id === selected?.id}
                    onSelect={() => {
                      setSelectedId(note.id);
                      setMobileDetailOpen(true);
                    }}
                  />
                ))}
              </div>
            </aside>

            {/* Right: opened note. On mobile, shown only after a note is tapped. */}
            <section
              className={`${
                mobileDetailOpen ? "block" : "hidden md:block"
              } min-w-0 flex-1`}
            >
              <button
                onClick={() => setMobileDetailOpen(false)}
                className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors md:hidden"
              >
                <ChevronLeft className="h-4 w-4" />
                All notes
              </button>
              {selected ? (
                <NoteDetail
                  key={selected.id}
                  note={selected}
                  notebooks={notebooks}
                  onMove={handleMove}
                  moving={movingId === selected.id}
                  onDelete={handleDelete}
                  deleting={deletingId === selected.id}
                />
              ) : (
                <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
                  Select a note to read it.
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function UsageMeter({ usage }: { usage: NotesListResponse["usage"] }) {
  const notesLabel =
    usage.savedNotesCap === null
      ? `${usage.savedNotes} notes`
      : `${usage.savedNotes} of ${usage.savedNotesCap} notes`;
  const pct =
    usage.storageBytesCap && usage.storageBytesCap > 0
      ? Math.min(100, (usage.usedBytes / usage.storageBytesCap) * 100)
      : 0;
  const storageLabel =
    usage.storageBytesCap === null
      ? formatBytes(usage.usedBytes)
      : `${formatBytes(usage.usedBytes)} / ${formatBytes(usage.storageBytesCap)}`;

  return (
    <div className="space-y-1.5 text-xs text-muted-foreground">
      <div className="flex items-center justify-between">
        <span>{notesLabel}</span>
        <span>{storageLabel}</span>
      </div>
      {usage.storageBytesCap !== null && (
        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-foreground"
            style={{ width: `${pct}%` }}
          />
        </span>
      )}
    </div>
  );
}
