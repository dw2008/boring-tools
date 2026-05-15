// LLM adapter — commentary + post-game digest
// Full implementation TBD; this file is the swap point if we change providers.

export type CommentaryRequest = {
  fen: string
  lastMoveSan: string
  engineEval: number
  bestMove: string
  pv: string[]
  evalDelta: number
}

export type CommentaryResponse = {
  text: string
}

export async function getCommentary(
  _req: CommentaryRequest,
): Promise<CommentaryResponse> {
  throw new Error('LLM adapter not yet implemented')
}

export type PostGameRequest = {
  pgn: string
  keyMoments: Array<{
    moveNumber: number
    san: string
    evalBefore: number
    evalAfter: number
  }>
}

export async function getPostGameDigest(_req: PostGameRequest): Promise<string> {
  throw new Error('LLM adapter not yet implemented')
}
