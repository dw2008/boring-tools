"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import type { Components } from "react-markdown";
import { Copy, Check, RotateCcw, Save, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Note } from "@/lib/tools/notes/types";
import type { SaveState } from "./notes-client";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 space-y-1 mb-3">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1 mb-3">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-muted-foreground/40 pl-3 italic text-muted-foreground my-3">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    return isBlock ? (
      <code className="block text-xs font-mono whitespace-pre">{children}</code>
    ) : (
      <code className="bg-muted rounded px-1 py-0.5 text-xs font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-muted rounded-md p-3 my-3 overflow-x-auto text-xs">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-4 border-border" />,
  // Cropped figure images are inlined as data URLs by the figures pipeline.
  // eslint-disable-next-line @next/next/no-img-element
  img: ({ src, alt }) => (
    <img
      src={typeof src === "string" ? src : ""}
      alt={alt ?? ""}
      className="my-3 max-h-[420px] w-auto rounded-md border bg-muted"
    />
  ),
};

// react-markdown strips data: URLs by default; allow data:image so cropped
// figures render, while still sanitizing every other URL.
const urlTransform = (url: string) =>
  url.startsWith("data:image/") ? url : defaultUrlTransform(url);

interface NotesResultProps {
  note: Note;
  // Markdown with cropped figure images inlined; falls back to note.markdown.
  displayMarkdown: string;
  onReset: () => void;
  // Re-run the digitizer on the same uploaded image.
  onRetry: () => void;
  isProcessing: boolean;
  onSave: () => void;
  saveState: SaveState;
  saveError: string | null;
}

export function NotesResult({
  note,
  displayMarkdown,
  onReset,
  onRetry,
  isProcessing,
  onSave,
  saveState,
  saveError,
}: NotesResultProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(note.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-2">
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <CardTitle className="text-base font-medium truncate">
          {note.title}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={
              isProcessing || saveState === "saving" || saveState === "saved"
            }
          >
            {saveState === "saving" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving
              </>
            ) : saveState === "saved" ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
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
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isProcessing || saveState === "saving"}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Retrying
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            New
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {saveState === "error" && saveError && (
          <p className="mb-3 text-sm text-destructive">{saveError}</p>
        )}
        {saveState === "saved" && (
          <p className="mb-3 text-sm text-muted-foreground">
            Saved to your library.{" "}
            <Link
              href="/notes/library"
              className="underline hover:text-foreground"
            >
              View my notes →
            </Link>
          </p>
        )}
        <div className="text-sm">
          <ReactMarkdown
            components={markdownComponents}
            urlTransform={urlTransform}
          >
            {displayMarkdown}
          </ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
