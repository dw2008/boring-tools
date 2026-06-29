// Monthly usage limits per tool (resets each billing period).
export const PLAN_LIMITS: Record<string, Record<string, number>> = {
  proofread: { free: 5, basic: 200, pro: Infinity },
  interview: { free: 3, basic: 50, pro: Infinity },
  chess: { free: 1, basic: 15, pro: Infinity },
  notes: { free: 3, basic: 50, pro: Infinity },
};

const MB = 1024 * 1024;
const GB = 1024 * MB;

// Caps on the saved-notes library (separate from the monthly digitize limit
// above). A save is allowed only if BOTH the note-count and storage-bytes caps
// still have room. "Unlimited" note count is still bounded by storageBytes.
export const NOTE_LIBRARY_LIMITS: Record<
  string,
  { savedNotes: number; storageBytes: number }
> = {
  free: { savedNotes: 30, storageBytes: 50 * MB },
  basic: { savedNotes: 600, storageBytes: 1 * GB },
  pro: { savedNotes: Infinity, storageBytes: 10 * GB },
};
