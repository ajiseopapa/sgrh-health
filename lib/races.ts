// 대회 데이터는 이제 Supabase races 테이블에서 관리합니다.
// (관리자 설정 > 대회 관리에서 추가/수정/삭제)
// 여기에는 날짜 계산용 유틸 함수만 남겨둡니다.

export function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function formatRaceDate(dateStr: string): string {
  const d = new Date(dateStr)
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${weekdays[d.getDay()]})`
}
