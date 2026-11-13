import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
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
      // v2.1 디자인 토큰 — 팔레트 '트랙 클럽' (PM 지시 11-13)
      //   배경 #F6F4EE · 기본 글자 #202D29 · 포인트 #D8F36A · 보조 #7B8780
      //   포인트(연두)는 면·막대·선택 표시에만 쓰고, 그 위 글자는 항상 기본 글자색(#202D29, 11.4:1).
      //   보조색 #7B8780 은 배경 위 3.4:1 이라 큰 글자·아이콘·선에만. 작은 보조 글자는 ink-400(#5E6A64, 5.1:1) 이상.
      colors: {
        paper: '#F6F4EE',   // 배경
        sheet: '#FCFBF7',   // 입력칸 바탕
        line: 'rgba(32,45,41,0.14)', // 구분선(기본 글자색 14%)
        brand: {
          50: '#F8FDE6',
          100: '#F0FAC9',
          200: '#E5F69C',
          300: '#D8F36A', // 포인트
          400: '#C6E44A',
          500: '#A9C82E',
          600: '#5C6E12', // 배경 위 글자로 쓸 때(5.1:1)
          700: '#48570D',
          800: '#36420A',
          900: '#232B06',
        },
        accent: {
          50: '#F8FDE6',
          400: '#C6E44A',
          500: '#A9C82E',
          600: '#5C6E12',
        },
        ink: {
          50: '#EEECE5',
          100: '#E2E1D9',
          200: '#C9CCC5',
          300: '#7B8780', // 보조(큰 글자·아이콘·선)
          400: '#5E6A64', // 작은 보조 글자 최소(5.1:1)
          500: '#4D5853',
          600: '#3C4743',
          700: '#2E3A36',
          800: '#263330',
          900: '#202D29', // 기본 글자
        },
        surface: '#F6F4EE',
      },
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Malgun Gothic',
          'sans-serif',
        ],
      },
      // 그림자는 떠 있는 창(시트·확인창)에만. 화면 안 영역은 구분선으로 나눕니다.
      boxShadow: {
        card: 'none',
        raised: '0 12px 32px -8px rgba(27,25,22,0.28)',
        nav: 'none',
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
