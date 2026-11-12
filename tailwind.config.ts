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
      // v2.1 디자인 토큰 — 따뜻한 아이보리·차콜 + 포인트 색 1개(솔잎 초록)
      // brand·accent 는 같은 초록 한 가지로 통일(예전 주황 accent 제거). 빨강은 오류 표시에만.
      colors: {
        paper: '#F4F0E8',   // 바탕 아이보리
        sheet: '#FBF9F4',   // 입력칸·시트 바탕(아주 옅은 아이보리)
        line: 'rgba(30,28,25,0.12)', // 구분선
        brand: {
          50: '#EAF3EE',
          100: '#D3E7DC',
          200: '#A9CFB9',
          300: '#7BB495',
          400: '#4E9873',
          500: '#2C7D58',
          600: '#1D6A48',
          700: '#17573B',
          800: '#12452F',
          900: '#0C3021',
        },
        accent: {
          50: '#EAF3EE',
          400: '#4E9873',
          500: '#2C7D58',
          600: '#1D6A48',
        },
        ink: {
          50: '#EFEAE0',
          100: '#E4DDD0',
          200: '#CFC7B8',
          300: '#8A8275', // 큰 글씨·장식용(3:1 이상)
          400: '#716A5E', // 작은 보조 글씨 최소(아이보리 위 4.6:1)
          500: '#665F54',
          600: '#4D473F',
          700: '#38332D',
          800: '#26231F',
          900: '#1B1916',
        },
        surface: '#F4F0E8',
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
