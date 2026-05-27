import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-5'

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
    if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set')
    _client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  }
  return _client
}

export type CommentaryRequest = {
  fen: string
  lastMoveSan: string
  engineEval: number
  bestMove: string
  pv: string[]
  evalDelta: number
  movedBy: 'w' | 'b'
}

function buildCommentaryPrompt(req: CommentaryRequest): string {
  const evalStr =
    Math.abs(req.engineEval) >= 10_000
      ? req.engineEval > 0
        ? 'white has a forced checkmate'
        : 'black has a forced checkmate'
      : `the engine evaluates the position at ${(req.engineEval / 100).toFixed(2)} pawns from white's perspective`

  const pvStr = req.pv.slice(0, 3).join(' ')

  if (req.movedBy === 'w') {
    return `You are a friendly chess assistant talking to a casual player. The player (white) just played ${req.lastMoveSan}. ${evalStr}. The engine's best line is ${pvStr || 'unknown'}.

In 1–2 short sentences, tell the player what their move does in plain English. Skip jargon. No intro, no filler — just the key idea.`
  } else {
    return `You are a friendly chess assistant talking to a casual player. Black just played ${req.lastMoveSan}. ${evalStr}. The engine's best line is ${pvStr || 'unknown'}.

In 1–2 short sentences, tell the white player what black is trying to do and what to watch out for. Plain English, no jargon, no intro.`
  }
}

export async function getCommentary(
  req: CommentaryRequest,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const debug = import.meta.env.VITE_DEBUG_LLM === '1'
  const prompt = buildCommentaryPrompt(req)
  if (debug) console.log('[LLM prompt]', prompt)

  const client = getClient()
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 80,
    messages: [{ role: 'user', content: prompt }],
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      if (debug) process.stdout.write(event.delta.text)
      onChunk(event.delta.text)
    }
  }

  if (debug) console.log('\n[LLM stream done]')
}

export type ChatRequest = {
  fen: string
  engineEval: number | null
  recentMoves: string[]   // last few SANs for context
  question: string
}

export async function getChatResponse(
  req: ChatRequest,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const client = getClient()
  const evalStr =
    req.engineEval === null
      ? 'unknown'
      : Math.abs(req.engineEval) >= 10_000
      ? req.engineEval > 0 ? 'white has a forced mate' : 'black has a forced mate'
      : `${(req.engineEval / 100).toFixed(2)} pawns (white's perspective)`

  const movesStr = req.recentMoves.length
    ? `Recent moves: ${req.recentMoves.slice(-6).join(', ')}.`
    : 'No moves played yet.'

  const system = `You are a friendly chess assistant. Current position FEN: ${req.fen}. ${movesStr} Engine evaluation: ${evalStr}. Answer in 1–2 short sentences using plain, everyday language. No jargon unless the player asks for it.`

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 200,
    system,
    messages: [{ role: 'user', content: req.question }],
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      onChunk(event.delta.text)
    }
  }
}

export type PostGameRequest = {
  pgn: string
  keyMoments: Array<{
    moveNumber: number
    san: string
    movedBy: 'w' | 'b'
    evalBefore: number
    evalAfter: number
    delta: number
  }>
}

export async function getPostGameDigest(
  req: PostGameRequest,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const client = getClient()
  const momentsText = req.keyMoments
    .map(
      (m) =>
        `Move ${m.moveNumber} (${m.san}, ${m.movedBy === 'w' ? 'White' : 'Black'}): eval swung from ${(m.evalBefore / 100).toFixed(2)} to ${(m.evalAfter / 100).toFixed(2)} (Δ${(m.delta / 100).toFixed(2)})`,
    )
    .join('\n')

  const prompt = `You are a chess assistant writing a post-game digest.

Game PGN:
${req.pgn}

Key moments by eval swing:
${momentsText || 'No major swings detected — a steady game.'}

Write a short post-game summary in plain, casual English — like a friend explaining the game, not a chess coach. Structure it as:
1. Opening (1 sentence on how the game started)
2. Key Moments (1–2 sentences per moment: what happened and why it mattered, simply)
3. Takeaway (1 sentence — the main thing to remember)

Keep it light and easy to read. Avoid chess jargon. Use "you" for the white player.`

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      onChunk(event.delta.text)
    }
  }
}
