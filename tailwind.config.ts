import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  safelist: [
    // StatsTab 랭킹 배지 동적 클래스
    'bg-accent-400',
    'bg-ink-300',
    'bg-ink-100',
    'text-white',
    'text-ink-500',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EAF6F1',
          100: '#CFEBE0',
          200: '#9FD7C1',
          300: '#6FC3A2',
          400: '#42AC85',
          500: '#1F9B7D',
          600: '#0F8268',
          700: '#0C6A55',
          800: '#0A5444',
          900: '#073D32',
        },
        accent: {
          50: '#FDF3E2',
          400: '#F6BB5C',
          500: '#F2A93B',
          600: '#E0901C',
        },
        ink: {
          50: '#F6F5F2',
          100: '#EAE8E2',
          200: '#D7D4CB',
          300: '#B5B1A4',
          400: '#8F8B7D',
          500: '#6E6A5E',
          600: '#535045',
          700: '#3D3B33',
          800: '#292722',
          900: '#1C1B17',
        },
        surface: '#F8F7F3',
      },
      fontFamily: {
        sans: [
          'var(--font-jakarta)',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Malgun Gothic',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,27,23,0.04), 0 8px 20px -6px rgba(28,27,23,0.10)',
        raised: '0 4px 14px -2px rgba(28,27,23,0.18)',
        nav: '0 -4px 20px rgba(28,27,23,0.06)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
export default config
