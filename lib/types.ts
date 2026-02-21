export interface ProofreadRequest {
  text: string;
}

export interface ProofreadResponse {
  original: string;
  fixed: string;
  hasChanges: boolean;
}
