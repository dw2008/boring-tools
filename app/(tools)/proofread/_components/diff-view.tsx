"use client";

import { computeWordDiff } from "@/lib/tools/proofread/diff";

interface GibberishRange {
  start: number;
  end: number;
}

interface DiffViewProps {
  original: string;
  fixed: string;
  gibberishRanges?: GibberishRange[];
}

/**
 * Checks if a span at [spanStart, spanEnd) overlaps with any gibberish range.
 */
function isInGibberishRange(
  spanStart: number,
  spanEnd: number,
  ranges: GibberishRange[]
): boolean {
  return ranges.some((r) => spanStart < r.end && spanEnd > r.start);
}

export function DiffView({ original, fixed, gibberishRanges }: DiffViewProps) {
  const diffs = computeWordDiff(original, fixed);

  // Track character position in the original text to map diff spans to gibberish ranges.
  // We track position in the original for removed (op=-1) and unchanged (op=0) spans.
  let originalOffset = 0;

  return (
    <div className="rounded-md border bg-muted/30 p-4 font-mono text-sm">
      <div className="leading-relaxed break-words">
        {diffs.map(([op, text], i) => {
          const spanStart = originalOffset;
          const spanEnd = spanStart + text.length;

          // Advance originalOffset for text that comes from the original
          if (op === -1 || op === 0) {
            originalOffset += text.length;
          }

          const isGibberish =
            gibberishRanges &&
            gibberishRanges.length > 0 &&
            (op === -1 || op === 0) &&
            isInGibberishRange(spanStart, spanEnd, gibberishRanges);

          if (op === -1) {
            return (
              <span
                key={i}
                className={
                  isGibberish
                    ? "bg-yellow-100 text-yellow-800 px-0.5 rounded-sm"
                    : "bg-red-100 text-red-900 line-through decoration-red-500/50 px-0.5 rounded-sm"
                }
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
          return (
            <span
              key={i}
              className={
                isGibberish
                  ? "bg-yellow-100 text-yellow-800 px-0.5 rounded-sm"
                  : undefined
              }
            >
              {text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
