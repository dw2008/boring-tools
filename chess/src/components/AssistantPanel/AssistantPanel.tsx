export default function AssistantPanel() {
  return (
    <aside className="flex flex-col w-[380px] shrink-0 bg-surface border-l border-divider h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[13px] font-semibold text-text-primary">Aether Assistant</span>
        </div>
        <span className="text-[11px] text-text-muted font-mono">• Analyzing position...</span>
      </div>

      {/* Body — placeholder for insights, move cards, chat */}
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-[12px] text-text-muted text-center">
          Strategic insights will appear here after each move.
        </p>
      </div>

      {/* Chat input */}
      <div className="px-4 py-3 border-t border-divider">
        <div className="flex items-center gap-2 bg-surface-elevated rounded px-3 py-2">
          <input
            className="flex-1 bg-transparent text-[13px] text-text-primary placeholder-text-muted outline-none"
            placeholder="Ask for advice or suggest a move..."
            disabled
          />
          <button className="text-accent">▶</button>
        </div>
        <div className="flex gap-3 mt-2 justify-center">
          {['Best Move?', 'Resign', 'Takeback'].map((label) => (
            <button
              key={label}
              className="text-[11px] text-text-muted hover:text-text-primary font-mono border border-divider rounded px-2 py-1 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
