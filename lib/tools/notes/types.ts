export interface Figure {
  token: string;
  caption: string;
  labels: string[];
  box: { x0: number; y0: number; x1: number; y1: number };
  // Set once a note is saved: Storage object path of this figure's cropped image.
  imagePath?: string;
  // Transient: short-lived signed URL for display in the library (not stored).
  imageUrl?: string;
}

export interface Note {
  id: string;
  title: string;
  markdown: string;
  figures?: Figure[];
  topic?: string;
  sourceImageRef?: string;
  createdAt: string;
}

export interface DigitizeResponse {
  note: Note;
}

export interface SaveNoteResponse {
  note: Note;
}

export interface SavedNote {
  id: string;
  title: string;
  markdown: string;
  figures: Figure[];
  topic?: string;
  createdAt: string;
  sizeBytes: number;
}

export interface NotesUsage {
  savedNotes: number;
  // null = unlimited (Infinity can't be JSON-serialized)
  savedNotesCap: number | null;
  usedBytes: number;
  storageBytesCap: number | null;
}

export interface NotesListResponse {
  notes: SavedNote[];
  usage: NotesUsage;
}
