import type { Metadata } from "next";
import { ProofreadClient } from "./_components/proofread-client";

export const metadata: Metadata = {
  title: "Proofread | boringtools",
  description:
    "Catch grammar errors without changing your style. Paste text, see a diff.",
};

export default function ProofreadPage() {
  return (
    <div className="container max-w-4xl py-10 px-4 space-y-8">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-3xl font-bold tracking-tight">
          Proofread your text
        </h2>
        <p className="text-muted-foreground">
          Paste your text below to catch grammar errors without changing your
          style.
        </p>
      </div>
      <ProofreadClient />
    </div>
  );
}
