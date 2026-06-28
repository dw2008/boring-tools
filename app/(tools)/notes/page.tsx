import type { Metadata } from "next";
import { NotesClient } from "./_components/notes-client";

export const metadata: Metadata = {
  title: "Note Digitizer | boringtools",
  description:
    "Snap a photo of a book page or handwritten notes, get clean Markdown back.",
};

export default function NotesPage() {
  return (
    <div className="container max-w-4xl py-10 px-4 space-y-8">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-3xl font-bold tracking-tight">
          Digitize your notes
        </h2>
        <p className="text-muted-foreground">
          Snap a photo of a book page or handwritten notes — get clean,
          structured Markdown back.
        </p>
      </div>
      <NotesClient />
    </div>
  );
}
