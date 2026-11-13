// ── 공통 디자인 토큰(JS에서 색 값이 필요한 곳: 차트 등) — tailwind.config.ts 와 같은 값 ──
export const TOKENS = {
  ink900: '#202D29',     // 기본 글자·진한 막대
  ink200: '#C9CCC5',     // 흐린 막대·축선
  highlight: '#D8F36A',  // 강조(형광 라임) = tailwind brand-300
} as const

// 직원 ID로부터 항상 같은 색상을 만들어내는 해시 함수.
// 캘린더 점, 랭킹 보드, 피드 아바타에서 한 사람당 같은 색이 일관되게 보입니다.
export const PALETTE = [
  '#FF6B6B', // 레드
  '#4D96FF', // 블루
  '#6BCB77', // 그린
  '#FFC542', // 옐로우
  '#9B5DE5', // 퍼플
  '#00C2A8', // 틸
  '#FF922B', // 오렌지
  '#F15BB5', // 핑크
  '#22B8CF', // 시안
  '#845EC2', // 인디고
]

export function colorForId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

// 직원에게 관리자가 지정한 색상이 있으면 그 색을, 없으면 ID 해시 기반 자동 색상을 반환합니다.
// 화면 곳곳(피드, 랭킹, 캘린더, 기록 탭)에서 이 함수 하나로 일관되게 색을 가져오면 됩니다.
export function getEmployeeColor(
  employee: { id: string; color?: string | null } | null | undefined
): string {
  if (!employee) return '#1F9B7D'
  return employee.color || colorForId(employee.id)
}

// 직원 색 원 위에 올릴 글자색. 흰색과 기본 글자색(#202D29) 중 명암비가 더 높은 쪽을 고릅니다.
// (노랑·연두처럼 밝은 색은 흰 글자가 2:1 아래로 떨어지므로 어두운 글자로 바꿉니다.)
const INK = '#202D29'
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)
  const ch = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  if (ch.some((v) => Number.isNaN(v))) return 0
  const [r, g, b] = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
export function textOnColor(bg: string): string {
  return contrastRatio('#FFFFFF', bg) >= contrastRatio(INK, bg) ? '#FFFFFF' : INK
}
