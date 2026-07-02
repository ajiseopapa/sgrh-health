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

// 접수 마감일 기준 상태 판별
// 'unknown' = 마감일 정보 없음 / 'open' = 접수중 / 'closing' = 마감 임박(7일 이내) / 'closed' = 마감됨
export function registrationStatus(deadline: string | null): 'open' | 'closing' | 'closed' | 'unknown' {
  if (!deadline) return 'unknown'
  const d = daysUntil(deadline)
  if (d < 0) return 'closed'
  if (d <= 7) return 'closing'
  return 'open'
}
