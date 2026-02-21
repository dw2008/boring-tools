"use client";

import { useState } from "react";
import type { ProofreadResponse } from "@/lib/types";
import { ProofreadInput } from "./proofread-input";
import { ProofreadResult } from "./proofread-result";

export function ProofreadClient() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ProofreadResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (text: string) => {
    setInput(text);
    if (result) setResult(null);
    if (error) setError(null);
  };

  const handleProofread = async () => {
    if (!input.trim()) return;
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
        throw new Error(data.error || "Something went wrong");
      }

      const data: ProofreadResponse = await response.json();
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
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
      {result && <ProofreadResult result={result} />}
    </div>
  );
}
