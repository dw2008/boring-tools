import DiffMatchPatch from "diff-match-patch";

export type Diff = [number, string];

/**
 * Computes a word-level diff between two strings.
 * Uses diff-match-patch with a words-to-chars encoding technique:
 * each unique word is mapped to a single character, enabling word-level
 * (rather than character-level) diffing.
 */
export function computeWordDiff(original: string, fixed: string): Diff[] {
  const dmp = new DiffMatchPatch();

  // Split text into words while preserving whitespace
  const wordMap = new Map<string, string>();
  const charMap = new Map<string, string>();
  let nextChar = 0x100; // Start beyond ASCII

  function wordsToChars(text: string): string {
    // Split on word boundaries, keeping whitespace attached
    const tokens = text.match(/\S+|\s+/g) || [];
    return tokens
      .map((token) => {
        if (!wordMap.has(token)) {
          const char = String.fromCharCode(nextChar);
          wordMap.set(token, char);
          charMap.set(char, token);
          nextChar++;
        }
        return wordMap.get(token)!;
      })
      .join("");
  }

  const chars1 = wordsToChars(original);
  const chars2 = wordsToChars(fixed);

  const diffs = dmp.diff_main(chars1, chars2, false);
  dmp.diff_cleanupSemantic(diffs);

  // Decode chars back to words
  return diffs.map(([op, text]) => {
    const decoded = Array.from(text)
      .map((char) => charMap.get(char) ?? char)
      .join("");
    return [op, decoded] as Diff;
  });
}
