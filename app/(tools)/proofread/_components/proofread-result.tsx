"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ProofreadResponse } from "@/lib/types";
import { DiffView } from "./diff-view";

interface ProofreadResultProps {
  result: ProofreadResponse;
}

export function ProofreadResult({ result }: ProofreadResultProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.fixed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasGibberish =
    result.gibberishRanges && result.gibberishRanges.length > 0;

  if (result.isFullyGibberish) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-6">
            <DiffView
              original={result.original}
              fixed={result.fixed}
              gibberishRanges={result.gibberishRanges}
            />
            <p className="text-yellow-800 text-sm mt-3 text-center">
              This text appears to be gibberish — no corrections were made.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!result.hasChanges && !hasGibberish) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="bg-muted/20">
          <CardContent className="p-6 text-center">
            <p className="text-green-600 font-medium">
              No changes needed! Your text looks great.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Changes Found</h3>
        <Button
          onClick={handleCopy}
          variant={copied ? "outline" : "default"}
          className={
            copied
              ? "border-green-500 text-green-600 hover:text-green-700"
              : ""
          }
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy Fixed Text
            </>
          )}
        </Button>
      </div>

      <Card className="bg-muted/20 border-green-200/50 overflow-hidden">
        <CardContent className="p-6">
          <DiffView
            original={result.original}
            fixed={result.fixed}
            gibberishRanges={result.gibberishRanges}
          />
        </CardContent>
      </Card>

      {hasGibberish && (
        <p className="text-xs text-muted-foreground text-center">
          <span className="inline-block w-3 h-3 bg-red-100 rounded-sm align-middle mr-1 border border-red-200" />
          <span className="line-through">Red strikethrough</span> = removed
          {" | "}
          <span className="inline-block w-3 h-3 bg-green-100 rounded-sm align-middle mr-1 border border-green-200" />
          Green = added
          {" | "}
          <span className="inline-block w-3 h-3 bg-yellow-100 rounded-sm align-middle mr-1 border border-yellow-200" />
          Yellow = unrecognized text (not proofread)
        </p>
      )}
    </div>
  );
}
