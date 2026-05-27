const MATE_SENTINEL = 10_000
const MAX_DISPLAY_CP = 600 // ±6 pawns = full bar

type Props = {
  evalCp: number | null
}

export default function EvalBar({ evalCp }: Props) {
  // White's share of the bar (0–1). 0.5 = equal.
  let whiteShare = 0.5

  if (evalCp !== null) {
    if (Math.abs(evalCp) >= MATE_SENTINEL) {
      whiteShare = evalCp > 0 ? 1 : 0
    } else {
      const clamped = Math.max(-MAX_DISPLAY_CP, Math.min(MAX_DISPLAY_CP, evalCp))
      whiteShare = (clamped + MAX_DISPLAY_CP) / (2 * MAX_DISPLAY_CP)
    }
  }

  const blackPercent = `${((1 - whiteShare) * 100).toFixed(1)}%`

  const label = formatEval(evalCp)

  return (
    <div className="flex flex-col items-center gap-1 w-5 self-stretch">
      {/* Bar — black on top, white on bottom (board orientation) */}
      <div className="relative flex-1 w-full rounded overflow-hidden bg-[#FAFAFA]">
        <div
          className="absolute top-0 left-0 w-full bg-[#18181B] transition-all duration-300"
          style={{ height: blackPercent }}
        />
      </div>
      {/* Numeric label */}
      <span className="text-[9px] font-mono text-text-muted tabular-nums leading-none">
        {label}
      </span>
    </div>
  )
}

function formatEval(evalCp: number | null): string {
  if (evalCp === null) return '—'
  if (Math.abs(evalCp) >= MATE_SENTINEL) {
    // mateIn isn't available here, but the label just shows +M / -M
    return evalCp > 0 ? '+M' : '-M'
  }
  const pawns = evalCp / 100
  const sign = pawns >= 0 ? '+' : ''
  return `${sign}${pawns.toFixed(2)}`
}
