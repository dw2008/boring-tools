export interface Figure {
  token: string;
  caption: string;
  labels: string[];
  box: { x0: number; y0: number; x1: number; y1: number };
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
