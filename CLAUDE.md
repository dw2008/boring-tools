# Aether Chess — AI Chess Co-pilot

## What this is

An interactive web app that plays chess against the user while providing real-time,
natural-language commentary on the position. Stockfish gives raw evaluation; an LLM
turns that into 2–3 sentence strategic insights for the user. After the game, the app
generates a "newsletter-style" digest of the tactical themes that came up.

Full PRD lives in `/docs/PRD.pdf`. Read it before starting major work.

## Stack

- **Build:** Vite + React 18 + TypeScript (strict mode on)
- **Styling:** Tailwind CSS. No CSS modules, no styled-components.
- **Chess logic:** `chess.js` for game state, move validation, FEN/PGN.
- **Board UI:** `react-chessboard`.
- **Engine:** Stockfish 16 WASM, running in a dedicated Web Worker. UCI protocol.
- **LLM:** Anthropic API, model `claude-sonnet-4-5`. The PRD mentions GPT-4o; we're
  swapping to Claude — cheaper round-trip from our infra and easier auth. Keep the
  LLM client behind a small adapter (`src/lib/llm.ts`) so this is a one-file swap if
  we change our minds.
- **State:** Zustand for game/UI state. No Redux.
- **Testing:** Vitest + React Testing Library.

## File layout

```
src/
  components/
    Board/              # chessboard + eval bar + coordinates
    AssistantPanel/     # right-side panel: insights, threat/complexity meters, chat input
    MoveList/           # move history (the "Move 18 / Knight to f3" cards from the mockup)
    Sidebar/            # left nav: Play / Analyze / Lessons / Engines / Profile
    PostGame/           # post-game summary view
  lib/
    engine/             # Stockfish worker + UCI wrapper
    llm.ts              # LLM adapter (commentary + post-game digest)
    chess/              # helpers around chess.js (eval normalization, swing detection)
  store/                # Zustand stores
  workers/
    stockfish.worker.ts
  App.tsx
  main.tsx
docs/
  PRD.pdf
```

## Design system (from the PRD mockup)

Dark, monochromatic, with a single teal accent. **Match the mockup exactly** — when
in doubt, ask before deviating.

- Background: `#0B1014` (near-black, slight blue tint)
- Surface (panels, cards): `#141B22`
- Surface elevated (hovered, active nav): `#1B242D`
- Border / divider: `#1F2A35`
- Text primary: `#E6EEF5`
- Text muted: `#8A99A8`
- Accent (teal): `#34D8C8` — used for highlights, active selections, the assistant's
  voice, eval bar fill, and the "f3" / square coordinate callouts in commentary.
- Danger / mistake: `#E5575A` (use sparingly, only for blunder indicators)

Typography: system UI stack, but commentary and move labels use a slight monospace
feel (`ui-monospace, "JetBrains Mono", monospace`) for the technical bits (move
numbers, square names, eval scores like `+0.82`).

Spacing: 4px base unit. Panels have 16px internal padding, 12px gap between cards.

Layout: three columns — sidebar (220px) / board (flex, max 720px) / assistant
(380px). Collapses to stacked on narrow viewports, but desktop-first.

## Engine integration — read this before touching Stockfish

1. **Cross-origin isolation is required** for `SharedArrayBuffer`, which Stockfish
   WASM needs. Vite config must set:
   ```
   server.headers = {
     'Cross-Origin-Opener-Policy': 'same-origin',
     'Cross-Origin-Embedder-Policy': 'require-corp',
   }
   ```
   Same headers must be configured on whatever we deploy to.

2. **Always run Stockfish in a Web Worker.** Never on the main thread — it will
   freeze the UI during deep searches.

3. **UCI protocol basics** the wrapper needs to handle:
   - `uci` → wait for `uciok`
   - `isready` → wait for `readyok`
   - `position fen <fen>` and `position startpos moves <moves>`
   - `go depth N` or `go movetime MS`
   - Parse `info depth N ... score cp X ...` lines for eval
   - Parse final `bestmove <move>`
   - Eval is from side-to-move's perspective in centipawns; normalize to
     white's perspective for the eval bar (negate when black to move).

4. **Mate scores:** `score mate N` means mate in N. Convert to a sentinel eval
   (e.g. ±10000) for display but show as "M3" in the UI, not "+100.00".

5. The engine wrapper exposes a Promise-based API:
   ```ts
   engine.evaluate(fen, { depth: 18 }) // → { eval, bestMove, pv, depth }
   ```
   Internally it queues requests — never send `go` while another search is running;
   send `stop` first and wait for `bestmove`.

## LLM commentary contract

The assistant panel updates after every move. The LLM call should:

- Receive: current FEN, last move (SAN), engine eval, best move, principal
  variation (first 3 plies), eval delta from previous position.
- Return: 2–3 sentences of strategic insight, in the voice shown in the mockup
  ("Moving your Knight to f3 significantly increases your control over the central
  squares. I currently evaluate this position at +0.82...").
- Use second person ("you"), refer to the engine eval directly, mention specific
  squares when relevant (the mockup highlights `f3` in the accent color — we should
  parse square names out of the response and style them).

Stream the response. The "Analyzing position..." indicator in the assistant header
stays on until the stream completes.

**Cost control:** don't call the LLM on every engine info update — only on completed
moves. Cache by FEN; if the user takes back and replays, reuse the cached commentary.

## Post-game summary

After resignation / checkmate / draw:

1. Walk the game move by move, collect (move number, eval before, eval after, SAN).
2. Identify "key moments" = positions where `|eval delta| > 100 centipawns` from the
   side-to-move's perspective. Cap at ~6 moments per game.
3. Send the list of key moments + full PGN to the LLM. Ask for a newsletter-style
   digest: opening notes, 1–2 paragraphs on each key moment, closing takeaway.
4. Render as the timeline in the PostGame view — reverse chronological per PRD.

## Coding conventions

- TypeScript strict. No `any` without a `// @ts-expect-error: <reason>` comment.
- Prefer named exports. Default exports only for React components that are
  top-level routes/pages.
- Components are functions, not classes. Hooks for state.
- One component per file. Co-locate component-specific subcomponents in the same
  folder, not the same file.
- Tailwind utility classes inline. Pull repeated combinations into a `cn()` helper
  or a small wrapper component — don't `@apply` in CSS.
- Tests live next to the file they test: `engine.ts` + `engine.test.ts`.
- Engine code, chess helpers, and the LLM adapter MUST have unit tests. UI
  components don't need them unless they have non-trivial logic.

## What NOT to do

- Don't add a backend. This is a static SPA — the only network calls are to the
  Anthropic API directly from the browser (we'll proxy through a tiny edge function
  later for key safety, but not in MVP).
- Don't add user accounts, persistence beyond `localStorage`, or multiplayer.
- Don't reimplement chess rules. Use `chess.js`.
- Don't try to make Stockfish reason about the position in words. Stockfish gives
  numbers; the LLM gives words. Keep that boundary clean.
- Don't introduce new dependencies without flagging them. If something needs a new
  package, mention it and what it's for before installing.

## When you're stuck

- Engine issues: check the Stockfish UCI spec, check the COOP/COEP headers, check
  the worker actually loaded the WASM.
- LLM weirdness: log the exact prompt and response. The adapter should support a
  `DEBUG_LLM=1` env that pretty-prints both.
- Layout issues: open the PRD mockup at `/docs/PRD.pdf` page 1 and compare side
  by side.
