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
  const evalSwing = (req.evalDelta / 100).toFixed(2)

  if (req.movedBy === 'w') {
    return `You are Aether, an AI chess assistant. The player (white) just played ${req.lastMoveSan}. ${evalStr}. The eval shifted by ${evalSwing} pawns. The engine's best continuation is ${pvStr || 'unknown'}.

In 2–3 sentences, give the player strategic insight about their move in second person ("you"). Mention specific squares like "f3" or "d5" when relevant. Be direct — no greeting or introduction.`
  } else {
    return `You are Aether, an AI chess assistant. Black just played ${req.lastMoveSan}. ${evalStr}. The eval shifted by ${evalSwing} pawns from white's perspective. The engine's best continuation is ${pvStr || 'unknown'}.

In 2–3 sentences, explain the strategic idea behind black's move — what they are threatening, what plan they are pursuing, and what the player (white) should watch out for. Mention specific squares like "f3" or "d5" when relevant. Speak in second person to the white player ("black is threatening…", "you should watch…"). No greeting or introduction.`
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
    max_tokens: 150,
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

  const system = `You are Aether, an AI chess assistant. Current position FEN: ${req.fen}. ${movesStr} Engine evaluation: ${evalStr}. Answer the player's question concisely in 1–3 sentences. Use second person. Mention specific squares when relevant.`

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

  const prompt = `You are Aether, an AI chess assistant writing a post-game digest.

Game PGN:
${req.pgn}

Key moments by eval swing:
${momentsText || 'No major swings detected — a steady game.'}

Write a newsletter-style digest in these sections:
1. Opening (1–2 sentences on the opening choices)
2. Key Moments (one short paragraph per moment above, explaining what happened and why it mattered)
3. Takeaway (1–2 sentences of the main lesson)

Use second person ("you" = the white player). Mention specific squares like d4 or f3 when relevant. Be direct and concise.`

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
