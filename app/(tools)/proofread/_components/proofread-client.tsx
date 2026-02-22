"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { AuthModal } from "@/components/auth-modal";
import type { ProofreadResponse } from "@/lib/types";
import { ProofreadInput } from "./proofread-input";
import { ProofreadResult } from "./proofread-result";

const FREE_LIMIT = 3;
const STORAGE_KEY = "proofread_count";

function getUsageCount(): number {
  if (typeof window === "undefined") return 0;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? parseInt(stored, 10) || 0 : 0;
}

function incrementUsageCount(): number {
  const count = getUsageCount() + 1;
  localStorage.setItem(STORAGE_KEY, String(count));
  return count;
}

export function ProofreadClient() {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ProofreadResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    setUsageCount(getUsageCount());
  }, []);

  const remaining = FREE_LIMIT - usageCount;

  const handleChange = (text: string) => {
    setInput(text);
    if (result) setResult(null);
    if (error) setError(null);
  };

  const handleProofread = async () => {
    if (!input.trim()) return;

    if (!user && usageCount >= FREE_LIMIT) {
      setAuthModalOpen(true);
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
        throw new Error(data.error || "Something went wrong");
      }

      const data: ProofreadResponse = await response.json();
      setResult(data);

      if (!user) {
        const newCount = incrementUsageCount();
        setUsageCount(newCount);
      }
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
      {!user && usageCount > 0 && usageCount < FREE_LIMIT && (
        <p className="text-sm text-muted-foreground text-center">
          {remaining} free proofread{remaining === 1 ? "" : "s"} remaining.{" "}
          <button
            onClick={() => setAuthModalOpen(true)}
            className="underline hover:text-foreground transition-colors"
          >
            Sign in
          </button>{" "}
          for unlimited access.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
      {result && <ProofreadResult result={result} />}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        trigger="usage-limit"
      />
    </div>
  );
}
