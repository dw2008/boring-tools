import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#18181B',
        surface: '#1F1F23',
        'surface-elevated': '#27272A',
        divider: 'rgba(255,255,255,0.08)',
        'text-primary': '#FAFAFA',
        'text-muted': '#A1A1AA',
        accent: '#34D8C8',
        danger: '#F87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
