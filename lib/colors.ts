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
