export interface GibberishRange {
  start: number;
  end: number;
}

export interface GibberishResult {
  isFullyGibberish: boolean;
  ranges: GibberishRange[];
}

/**
 * Common punctuation-only tokens that should NOT be flagged as gibberish.
 */
const ALLOWED_PUNCTUATION = new Set([
  "...",
  "…",
  "—",
  "–",
  "-",
  "?!",
  "!?",
  "??",
  "!!",
  "?",
  "!",
  ".",
  ",",
  ";",
  ":",
  "'",
  '"',
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  "/",
  "&",
  "@",
  "#",
  "$",
  "%",
  "+",
  "=",
  "*",
]);

/**
 * Checks if a single non-whitespace token is gibberish.
 *
 * A token is gibberish if:
 * - Less than 30% of its characters are Unicode letters (any script), OR
 * - It contains 3+ consecutive identical special (non-letter) characters
 *
 * Exceptions:
 * - Common punctuation tokens (see ALLOWED_PUNCTUATION) are never gibberish
 * - Single characters are never gibberish
 */
function isTokenGibberish(token: string): boolean {
  // Single characters are never gibberish
  if (token.length <= 1) return false;

  // Common punctuation patterns are fine
  if (ALLOWED_PUNCTUATION.has(token)) return false;

  // Check for 3+ consecutive identical special characters (e.g., "###", "!!!")
  // But only if they're not in the allowed set (already checked above)
  if (/([^\p{L}\p{N}\s])\1{2,}/u.test(token)) return true;

  // Calculate percentage of Unicode letters
  const chars = Array.from(token);
  const letterCount = chars.filter((ch) => /\p{L}/u.test(ch)).length;
  const letterRatio = letterCount / chars.length;

  // If less than 30% letters, it's gibberish
  if (letterRatio < 0.3) return true;

  return false;
}

/**
 * Detects gibberish segments in text.
 *
 * Returns character ranges marking gibberish tokens and a flag indicating
 * whether the entire text is gibberish (>80% of tokens are gibberish).
 *
 * Foreign languages (CJK, Arabic, Cyrillic, etc.) pass through fine —
 * only random symbol sequences get flagged.
 */
export function detectGibberish(text: string): GibberishResult {
  const tokens = text.match(/\S+|\s+/g) || [];
  const ranges: GibberishRange[] = [];

  let offset = 0;
  let gibberishTokenCount = 0;
  let nonWhitespaceTokenCount = 0;

  for (const token of tokens) {
    const isWhitespace = /^\s+$/.test(token);

    if (!isWhitespace) {
      nonWhitespaceTokenCount++;

      if (isTokenGibberish(token)) {
        gibberishTokenCount++;
        ranges.push({ start: offset, end: offset + token.length });
      }
    }

    offset += token.length;
  }

  const isFullyGibberish =
    nonWhitespaceTokenCount > 0 &&
    gibberishTokenCount / nonWhitespaceTokenCount > 0.8;

  return { isFullyGibberish, ranges };
}
