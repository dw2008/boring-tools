"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { AuthModal } from "@/components/auth-modal";
import type {
  DigitizeResponse,
  Note,
  SaveNoteResponse,
} from "@/lib/tools/notes/types";
import { NotesUpload } from "./notes-upload";
import { NotesResult } from "./notes-result";
import {
  toCleanMarkdown,
  toDisplayMarkdown,
  cropFiguresToBlobs,
} from "./figures";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function NotesClient() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  // Display copy of the markdown with cropped figure images inlined; the Note
  // itself keeps clean text-only markdown for copy/export.
  const [displayMarkdown, setDisplayMarkdown] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Manage object URL lifecycle for the selected image preview
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileSelected = (next: File | null) => {
    setFile(next);
    if (note) setNote(null);
    if (displayMarkdown) setDisplayMarkdown(null);
    if (error) setError(null);
    if (limitReached) setLimitReached(false);
    setSaveState("idle");
    setSaveError(null);
  };

  const handleReset = () => {
    setFile(null);
    setNote(null);
    setDisplayMarkdown(null);
    setError(null);
    setLimitReached(false);
    setSaveState("idle");
    setSaveError(null);
  };

  const handleSubmit = async () => {
    if (!file) return;

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    setIsProcessing(true);
    setError(null);
    // A fresh (or retried) digitization invalidates any prior save.
    setSaveState("idle");
    setSaveError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/notes", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();

        if (response.status === 401) {
          setAuthModalOpen(true);
          return;
        }

        if (response.status === 403) {
          setLimitReached(true);
          return;
        }

        if (response.status === 429) {
          setError("Too many requests. Please slow down and try again shortly.");
          return;
        }

        throw new Error(data.error || "Something went wrong");
      }

      const data: DigitizeResponse = await response.json();
      const figures = data.note.figures;

      // Bake the raw "{{FIG_n}}" tokens into two views: clean text for the
      // stored Note (copy/export) and an image-inlined copy for the viewer.
      const cleanMarkdown = toCleanMarkdown(data.note.markdown, figures);
      setNote({ ...data.note, markdown: cleanMarkdown });
      setDisplayMarkdown(
        await toDisplayMarkdown(file, data.note.markdown, figures),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!file || !note) return;

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    setSaveState("saving");
    setSaveError(null);

    try {
      // Re-crop each figure to a JPEG blob for upload alongside the metadata.
      const blobs = await cropFiguresToBlobs(file, note.figures);

      const formData = new FormData();
      formData.append(
        "note",
        JSON.stringify({
          title: note.title,
          markdown: note.markdown,
          topic: note.topic,
          figures: (note.figures ?? []).map(({ token, caption, labels, box }) => ({
            token,
            caption,
            labels,
            box,
          })),
        }),
      );
      for (const [token, blob] of blobs) {
        formData.append(`figure:${token}`, blob, "figure.jpg");
      }

      const response = await fetch("/api/notes/save", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
          setSaveState("idle");
          setAuthModalOpen(true);
          return;
        }

        // 403 = saved-notes count or storage cap reached.
        setSaveError(
          data.error ||
            (response.status === 403
              ? "You've reached your saved-notes limit."
              : "Couldn't save this note. Please try again."),
        );
        setSaveState("error");
        return;
      }

      const data: SaveNoteResponse = await response.json();
      setNote(data.note); // persisted note (id, figure image paths, createdAt)
      setSaveState("saved");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
      setSaveState("error");
    }
  };

  return (
    <div className="grid gap-8">
      {!note && (
        <NotesUpload
          file={file}
          previewUrl={previewUrl}
          onFileSelected={handleFileSelected}
          onSubmit={handleSubmit}
          isProcessing={isProcessing}
        />
      )}
      {!user && (
        <p className="text-sm text-muted-foreground text-center">
          <button
            onClick={() => setAuthModalOpen(true)}
            className="underline hover:text-foreground transition-colors"
          >
            Sign in
          </button>{" "}
          to digitize your notes.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
      {limitReached && (
        <p className="text-sm text-muted-foreground text-center">
          You&apos;ve reached your monthly limit.{" "}
          <a
            href="/billing"
            className="underline hover:text-foreground transition-colors"
          >
            Upgrade your plan
          </a>{" "}
          for more digitizations.
        </p>
      )}
      {note && (
        <NotesResult
          note={note}
          displayMarkdown={displayMarkdown ?? note.markdown}
          onReset={handleReset}
          onRetry={handleSubmit}
          isProcessing={isProcessing}
          onSave={handleSave}
          saveState={saveState}
          saveError={saveError}
        />
      )}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        trigger="manual"
      />
    </div>
  );
}
