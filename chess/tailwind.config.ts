import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0B1014',
        surface: '#141B22',
        'surface-elevated': '#1B242D',
        divider: '#1F2A35',
        'text-primary': '#E6EEF5',
        'text-muted': '#8A99A8',
        accent: '#34D8C8',
        danger: '#E5575A',
      },
      fontFamily: {
        mono: ['ui-monospace', 'JetBrains Mono', 'monospace'],
      },
      spacing: {
        // 4px base unit — Tailwind default is already 4px, just documenting
      },
    },
  },
  plugins: [],
}

export default config
