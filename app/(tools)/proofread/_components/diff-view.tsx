"use client";

import { computeWordDiff } from "@/lib/tools/proofread/diff";

interface DiffViewProps {
  original: string;
  fixed: string;
}

export function DiffView({ original, fixed }: DiffViewProps) {
  const diffs = computeWordDiff(original, fixed);

  return (
    <div className="rounded-md border bg-muted/30 p-4 font-mono text-sm">
      <div className="leading-relaxed break-words">
        {diffs.map(([op, text], i) => {
          if (op === -1) {
            return (
              <span
                key={i}
                className="bg-red-100 text-red-900 line-through decoration-red-500/50 px-0.5 rounded-sm"
              >
                {text}
              </span>
            );
          }
          if (op === 1) {
            return (
              <span
                key={i}
                className="bg-green-100 text-green-900 font-medium px-0.5 rounded-sm"
              >
                {text}
              </span>
            );
          }
          return <span key={i}>{text}</span>;
        })}
      </div>
    </div>
  );
}
