"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { detectGibberish } from "@/lib/tools/proofread/gibberish";
import type { ProofreadResponse } from "@/lib/types";
import { ProofreadInput } from "./proofread-input";
import { ProofreadResult } from "./proofread-result";

export function ProofreadClient() {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ProofreadResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [authModalTrigger, setAuthModalTrigger] = useState<
    "usage-limit" | "manual"
  >("manual");

  const handleChange = (text: string) => {
    setInput(text);
    if (result) setResult(null);
    if (error) setError(null);
  };

  const handleProofread = async () => {
    if (!input.trim()) return;

    // Require sign-in before proofreading
    if (!user) {
      setAuthModalTrigger("manual");
      setAuthModalOpen(true);
      return;
    }

    // Run gibberish detection before calling the API
    const gibberish = detectGibberish(input);

    if (gibberish.isFullyGibberish) {
      // Skip API call entirely — show result with yellow highlighting
      setResult({
        original: input,
        fixed: input,
        hasChanges: false,
        gibberishRanges: gibberish.ranges,
        isFullyGibberish: true,
      });
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/proofread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });

      if (!response.ok) {
        const data = await response.json();

        if (response.status === 401) {
          setAuthModalTrigger("manual");
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

      const data: ProofreadResponse = await response.json();

      // Attach gibberish ranges to the result for partial highlighting
      if (gibberish.ranges.length > 0) {
        data.gibberishRanges = gibberish.ranges;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid gap-8">
      <ProofreadInput
        value={input}
        onChange={handleChange}
        onSubmit={handleProofread}
        isProcessing={isProcessing}
      />
      {!user && (
        <p className="text-sm text-muted-foreground text-center">
          <button
            onClick={() => {
              setAuthModalTrigger("manual");
              setAuthModalOpen(true);
            }}
            className="underline hover:text-foreground transition-colors"
          >
            Sign in
          </button>{" "}
          to use the proofreader.
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
          for more proofreads.
        </p>
      )}
      {result && <ProofreadResult result={result} />}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        trigger={authModalTrigger}
      />
    </div>
  );
}
