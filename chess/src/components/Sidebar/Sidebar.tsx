import { cn } from '../../lib/cn'

type NavItem = {
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Play', icon: '⊞' },
  { label: 'Analyze', icon: '◎' },
  { label: 'Lessons', icon: '⊙' },
  { label: 'Engines', icon: '⚙' },
  { label: 'Profile', icon: '◯' },
]

type Props = {
  activeNav?: string
}

export default function Sidebar({ activeNav = 'Play' }: Props) {
  return (
    <aside className="flex flex-col w-[220px] shrink-0 bg-surface border-r border-divider h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-divider">
        <span className="text-accent text-sm font-mono font-semibold tracking-wide">
          Aether Chess AI
        </span>
      </div>

      {/* Player card */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-divider">
        <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-xs text-text-muted">
          GM
        </div>
        <div>
          <p className="text-[13px] font-semibold text-text-primary leading-tight">Grandmaster</p>
          <p className="text-[11px] text-text-muted font-mono">ELO 2450</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-2 py-2 flex-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded text-[13px] w-full text-left transition-colors',
              item.label === activeNav
                ? 'bg-surface-elevated text-accent font-medium'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated',
            )}
          >
            <span className="text-base w-4 text-center">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* New Game button */}
      <div className="px-4 py-4 border-t border-divider">
        <button className="w-full bg-accent text-background text-sm font-semibold py-2 rounded hover:brightness-110 transition-all">
          + New Game
        </button>
      </div>
    </aside>
  )
}
