export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getMonthRange(base: Date = new Date()) {
  const year = base.getFullYear()
  const month = base.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return { start, end, year, month }
}

// 캘린더 그리드용 셀 배열 생성 (일요일 시작, null은 빈 칸)
export function getCalendarCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1)
  const lastDate = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDay.getDay() // 0 = 일요일

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= lastDate; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/**
 * 날짜 문자열 배열('YYYY-MM-DD')로부터 오늘 기준 연속 운동 일수를 계산.
 * StreakBadge, StatsTab에서 공용으로 사용 — 로직이 두 곳에서 갈라지지 않도록 여기 하나만 유지.
 */
export function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0

  // 중복 제거 후 최신순 정렬
  const unique = [...new Set(dates)].sort((a, b) => (a > b ? -1 : 1))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = 0
  let expected = new Date(today)

  for (const d of unique) {
    const date = new Date(d)
    date.setHours(0, 0, 0, 0)
    const diff = Math.round((expected.getTime() - date.getTime()) / 86_400_000)
    if (diff === 0) {
      streak++
      expected.setDate(expected.getDate() - 1)
    } else if (diff === 1 && streak === 0) {
      // 오늘 기록이 없어도 어제부터 연속이면 유지
      streak++
      expected = new Date(date)
      expected.setDate(expected.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}
