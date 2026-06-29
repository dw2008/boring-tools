import type { Metadata } from "next";
import { LibraryClient } from "./_components/library-client";

export const metadata: Metadata = {
  title: "My Notes | boringtools",
  description: "Your saved digitized notes.",
};

export default function NotesLibraryPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 space-y-6">
      <LibraryClient />
    </div>
  );
}
