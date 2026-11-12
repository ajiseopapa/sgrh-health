// v2.1 참여 기능 계산 — 목표·챌린지·배지·부서 순위
//
// 모든 진행률·순위는 저장하지 않고 운동 기록(exercise_logs)에서 그때그때 계산합니다.
// → 기록을 수정·삭제하면 다음 조회부터 바로 다시 계산됩니다.
//
// 규칙 (PM v2.1 지시서 2항)
//  · 날짜는 모두 한국 시간(Asia/Seoul) 기준. 한 주는 월요일~일요일.
//  · 인정 운동 시간: 직원·날짜별 합계를 하루 최대 300분까지만 인정.
//  · 시간이 없는 과거 기록: 운동 횟수·활동일에는 들어가고, 운동 시간은 0분.
//  · 챌린지: 시작일 전 기록은 인정하지 않음. 늦게 참여해도 기간 안의 기존 기록은 인정.
//            결과는 항상 현재 기록 기준(종료 뒤 기간 안 날짜로 고친 기록도 반영).
//  · 배지: 현재 기록으로 조건을 다시 판정해, 새로 충족하면 지급하고 기록 삭제로 조건이 깨지면 회수.
import type { SupabaseClient } from '@supabase/supabase-js'

export const DAILY_CAP_SECONDS = 300 * 60

// ── 날짜 (한국 시간) ──
export function kstToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** 그 날짜가 속한 주의 월요일 */
export function weekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay() // 0=일
  return addDays(date, -((dow + 6) % 7))
}
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}
export function monthEnd(date: string): string {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 1)
  d.setUTCDate(0)
  return d.toISOString().slice(0, 10)
}

// ── 1,000행 제한 없이 끝까지 나눠 읽기 (정렬 칸을 꼭 지정) ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readAllRows<T>(make: () => any, orderBy: string[]): Promise<T[]> {
  const out: T[] = []
  for (let off = 0; ; off += 1000) {
    let q = make()
    for (const col of orderBy) q = q.order(col)
    const { data, error } = await q.range(off, off + 999)
    if (error) throw new Error('ROWS_READ_FAILED')
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) return out
  }
}

// ── 기록 읽기 (1,000건 제한 없이) ──
export interface LogLite {
  employee_id: string
  log_date: string
  duration_seconds: number | null
  duration_minutes: number | null
}
export async function loadLogs(
  db: SupabaseClient,
  opts: { employeeId?: string; from?: string; to?: string } = {}
): Promise<LogLite[]> {
  const out: LogLite[] = []
  for (let off = 0; ; off += 1000) {
    let q = db.from('exercise_logs').select('id, employee_id, log_date, duration_seconds, duration_minutes').order('id')
    if (opts.employeeId) q = q.eq('employee_id', opts.employeeId)
    if (opts.from) q = q.gte('log_date', opts.from)
    if (opts.to) q = q.lte('log_date', opts.to)
    const { data, error } = await q.range(off, off + 999)
    if (error) throw new Error('LOGS_READ_FAILED')
    out.push(...(data as LogLite[]))
    if (!data || data.length < 1000) return out
  }
}

export function logSeconds(l: LogLite): number {
  return l.duration_seconds ?? (l.duration_minutes ? l.duration_minutes * 60 : 0)
}

/** 직원·날짜별 묶음: 횟수, 인정 시간(초, 300분 상한) */
export interface DayCredit { employeeId: string; date: string; sessions: number; seconds: number }
export function dailyCredits(logs: LogLite[]): DayCredit[] {
  const map = new Map<string, DayCredit>()
  for (const l of logs) {
    const key = `${l.employee_id}|${l.log_date}`
    const c = map.get(key) ?? { employeeId: l.employee_id, date: l.log_date, sessions: 0, seconds: 0 }
    c.sessions++
    c.seconds += logSeconds(l)
    map.set(key, c)
  }
  for (const c of map.values()) c.seconds = Math.min(c.seconds, DAILY_CAP_SECONDS)
  return [...map.values()]
}

export interface Totals { sessions: number; minutes: number; activeDays: number }
export function totals(credits: DayCredit[], from?: string, to?: string): Totals {
  let sessions = 0, seconds = 0, activeDays = 0
  for (const c of credits) {
    if (from && c.date < from) continue
    if (to && c.date > to) continue
    sessions += c.sessions
    seconds += c.seconds
    activeDays++
  }
  return { sessions, minutes: Math.floor(seconds / 60), activeDays }
}

export type Metric = 'sessions' | 'minutes' | 'active_days'
export function metricValue(t: Totals, metric: Metric): number {
  return metric === 'sessions' ? t.sessions : metric === 'minutes' ? t.minutes : t.activeDays
}

/** 날짜들 중 가장 긴 연속 일수와, 오늘(또는 어제)까지 이어진 현재 연속 일수 */
export function streaks(dates: string[], today: string): { longest: number; current: number } {
  const days = [...new Set(dates)].sort()
  let longest = 0, run = 0, prev = ''
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = d
  }
  let current = 0
  const set = new Set(days)
  let cursor = set.has(today) ? today : addDays(today, -1)
  while (set.has(cursor)) { current++; cursor = addDays(cursor, -1) }
  return { longest, current }
}

// ── 개인 목표 ──
export interface GoalRow { kind: 'sessions' | 'minutes'; target: number; effective_from: string }
/** 그 주에 적용되는 목표 = 그 주 월요일 이전(포함)에 정한 것 중 가장 최근 */
export function goalForWeek(goals: GoalRow[], week: string): GoalRow | null {
  let best: GoalRow | null = null
  for (const g of goals) if (g.effective_from <= week && (!best || g.effective_from > best.effective_from)) best = g
  return best
}
export function goalValue(t: Totals, kind: 'sessions' | 'minutes'): number {
  return kind === 'sessions' ? t.sessions : t.minutes
}
/** 목표를 달성한 주 수 (목표가 있던 주 중, 이번 주는 이미 달성했을 때만) */
export function achievedWeeks(goals: GoalRow[], credits: DayCredit[], today: string): number {
  if (goals.length === 0) return 0
  const first = goals.map((g) => g.effective_from).sort()[0]
  let n = 0
  for (let w = first; w <= weekStart(today); w = addDays(w, 7)) {
    const g = goalForWeek(goals, w)
    if (!g) continue
    if (goalValue(totals(credits, w, addDays(w, 6)), g.kind) >= g.target) n++
  }
  return n
}

// ── 배지 ──
export interface BadgeDef { key: string; series: 'sessions' | 'streak' | 'goalweeks'; threshold: number; label: string; condition: string }
export const BADGES: BadgeDef[] = [
  { key: 'sessions_1', series: 'sessions', threshold: 1, label: '첫 기록', condition: '운동 기록 1회' },
  { key: 'sessions_10', series: 'sessions', threshold: 10, label: '열 번째', condition: '누적 운동 기록 10회' },
  { key: 'sessions_30', series: 'sessions', threshold: 30, label: '서른 번', condition: '누적 운동 기록 30회' },
  { key: 'sessions_100', series: 'sessions', threshold: 100, label: '백 번', condition: '누적 운동 기록 100회' },
  { key: 'streak_3', series: 'streak', threshold: 3, label: '3일 연속', condition: '3일 연속 운동' },
  { key: 'streak_7', series: 'streak', threshold: 7, label: '일주일 연속', condition: '7일 연속 운동' },
  { key: 'streak_14', series: 'streak', threshold: 14, label: '2주 연속', condition: '14일 연속 운동' },
  { key: 'streak_30', series: 'streak', threshold: 30, label: '한 달 연속', condition: '30일 연속 운동' },
  { key: 'goalweeks_1', series: 'goalweeks', threshold: 1, label: '목표 달성', condition: '주간 목표 1회 달성' },
  { key: 'goalweeks_4', series: 'goalweeks', threshold: 4, label: '목표 4주', condition: '주간 목표 4회 달성' },
  { key: 'goalweeks_12', series: 'goalweeks', threshold: 12, label: '목표 12주', condition: '주간 목표 12회 달성' },
]
export const SERIES_LABEL = { sessions: '누적 기록', streak: '연속 운동', goalweeks: '목표 달성' } as const

export interface BadgeStats { sessions: number; longestStreak: number; goalWeeks: number }
export function earnedKeys(s: BadgeStats): string[] {
  const v = { sessions: s.sessions, streak: s.longestStreak, goalweeks: s.goalWeeks }
  return BADGES.filter((b) => v[b.series] >= b.threshold).map((b) => b.key)
}
export function nextBadges(s: BadgeStats) {
  const v = { sessions: s.sessions, streak: s.longestStreak, goalweeks: s.goalWeeks }
  return (Object.keys(SERIES_LABEL) as (keyof typeof SERIES_LABEL)[]).map((series) => {
    const next = BADGES.find((b) => b.series === series && v[series] < b.threshold)
    return { series, seriesLabel: SERIES_LABEL[series], current: v[series], next: next ? { key: next.key, label: next.label, condition: next.condition, threshold: next.threshold } : null }
  })
}

/**
 * 배지를 현재 기록 기준으로 맞춥니다. 새로 충족한 배지는 지급(이미 있으면 그대로),
 * 기록 삭제로 조건이 깨진 배지는 회수. 같은 배지가 두 번 들어가지 않는 것은 DB 기본키가 보장합니다.
 */
export async function syncBadges(db: SupabaseClient, employeeId: string, s: BadgeStats) {
  const want = new Set(earnedKeys(s))
  const { data: have } = await db.from('employee_badges').select('badge_key, awarded_at').eq('employee_id', employeeId)
  const haveKeys = new Set((have ?? []).map((b) => b.badge_key))
  const add = [...want].filter((k) => !haveKeys.has(k))
  const remove = [...haveKeys].filter((k) => !want.has(k))
  if (add.length) {
    const { error } = await db
      .from('employee_badges')
      .upsert(add.map((badge_key) => ({ employee_id: employeeId, badge_key })), { onConflict: 'employee_id,badge_key', ignoreDuplicates: true })
    if (error) throw new Error('BADGE_SYNC_FAILED')
  }
  if (remove.length) await db.from('employee_badges').delete().eq('employee_id', employeeId).in('badge_key', remove)
  const { data: now } = await db.from('employee_badges').select('badge_key, awarded_at').eq('employee_id', employeeId)
  return { rows: now ?? [], added: add, removed: remove }
}

// ── 한 직원의 전체 현황 (도전 화면) ──
export async function employeeOverview(db: SupabaseClient, employeeId: string, today = kstToday()) {
  const [logs, { data: goalRows }] = await Promise.all([
    loadLogs(db, { employeeId }),
    db.from('personal_goals').select('kind, target, effective_from').eq('employee_id', employeeId).order('effective_from'),
  ])
  const goals = (goalRows ?? []) as GoalRow[]
  const credits = dailyCredits(logs)
  const week = weekStart(today)
  const weekEnd = addDays(week, 6)
  const weekTotals = totals(credits, week, weekEnd)
  const goal = goalForWeek(goals, week)
  const all = totals(credits)
  const { longest, current } = streaks(credits.map((c) => c.date), today)
  const stats: BadgeStats = { sessions: all.sessions, longestStreak: longest, goalWeeks: achievedWeeks(goals, credits, today) }
  const badges = await syncBadges(db, employeeId, stats)
  const awarded = new Map(badges.rows.map((b) => [b.badge_key, b.awarded_at]))

  // 최근 7일 (오늘 포함) 하루별 인정 시간·횟수 — 이번 주 기록 막대용
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((d) => {
    const c = credits.find((x) => x.date === d)
    return { date: d, sessions: c?.sessions ?? 0, minutes: c ? Math.floor(c.seconds / 60) : 0 }
  })

  return {
    today,
    week: { start: week, end: weekEnd, ...weekTotals, days },
    goal: goal ? { kind: goal.kind, target: goal.target, value: goalValue(weekTotals, goal.kind) } : null,
    goalSetThisWeek: goals.some((g) => g.effective_from === week),
    streak: { current, longest },
    total: all,
    badges: {
      earned: BADGES.filter((b) => awarded.has(b.key)).map((b) => ({ key: b.key, label: b.label, condition: b.condition, series: b.series, awarded_at: awarded.get(b.key) })),
      next: nextBadges(stats),
    },
    credits, // 챌린지 계산에 재사용 (응답에는 넣지 않음)
  }
}

// ── 챌린지 ──
export interface ChallengeRow { id: string; title: string; description: string | null; metric: Metric; target: number; start_date: string; end_date: string }
export function challengeStatus(c: ChallengeRow, today: string): 'upcoming' | 'active' | 'ended' {
  return today < c.start_date ? 'upcoming' : today > c.end_date ? 'ended' : 'active'
}
/** 시작일 전 기록은 빼고, 기간 안(오늘까지)의 기록만 셉니다. 참여일과는 무관. */
export function challengeProgress(c: ChallengeRow, credits: DayCredit[], today: string): number {
  const to = c.end_date < today ? c.end_date : today
  if (to < c.start_date) return 0
  return metricValue(totals(credits, c.start_date, to), c.metric)
}

// ── 부서 순위 ──
export interface DeptRank {
  id: string | null
  name: string
  participants: number
  sessions: number
  minutes: number
  headcount: number | null
  rate: number | null // headcount 가 있을 때만
}
export async function departmentRanking(db: SupabaseClient, period: 'week' | 'month', today = kstToday()) {
  const from = period === 'week' ? weekStart(today) : monthStart(today)
  const to = today
  // 참여율은 기간이 끝나는 날(오늘)이 속한 달의 인사팀 확인 인원으로 계산
  const yearMonth = to.slice(0, 7)
  const [logs, { data: depts }, { data: hist }, { data: heads }] = await Promise.all([
    loadLogs(db, { from, to }),
    db.from('departments').select('id, name, sort_order').order('sort_order').order('name'),
    readAllRows<{ employee_id: string; department_id: string; start_date: string; end_date: string | null }>(
      () => db.from('employee_departments').select('employee_id, department_id, start_date, end_date'), ['employee_id', 'start_date']
    ).then((data) => ({ data })),
    db.from('department_headcounts').select('department_id, headcount, source').eq('year_month', yearMonth),
  ])
  const deptOf = (employeeId: string, date: string): string | null => {
    for (const h of hist ?? []) {
      if (h.employee_id === employeeId && h.start_date <= date && (!h.end_date || date < h.end_date)) return h.department_id
    }
    return null
  }
  const acc = new Map<string | null, { people: Set<string>; sessions: number; seconds: number }>()
  for (const c of dailyCredits(logs)) {
    const d = deptOf(c.employeeId, c.date)
    const a = acc.get(d) ?? { people: new Set<string>(), sessions: 0, seconds: 0 }
    a.people.add(c.employeeId)
    a.sessions += c.sessions
    a.seconds += c.seconds
    acc.set(d, a)
  }
  const headMap = new Map((heads ?? []).map((h) => [h.department_id, h.headcount as number]))
  const rows: DeptRank[] = (depts ?? []).map((d) => {
    const a = acc.get(d.id)
    const headcount = headMap.get(d.id) ?? null
    const participants = a?.people.size ?? 0
    return {
      id: d.id,
      name: d.name,
      participants,
      sessions: a?.sessions ?? 0,
      minutes: a ? Math.floor(a.seconds / 60) : 0,
      headcount,
      rate: headcount ? Math.min(1, participants / headcount) : null,
    }
  })
  const un = acc.get(null)
  const unassigned = un ? { participants: un.people.size, sessions: un.sessions, minutes: Math.floor(un.seconds / 60) } : { participants: 0, sessions: 0, minutes: 0 }
  const bySessions = [...rows].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, 'ko'))
  const byMinutes = [...rows].sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, 'ko'))
  return { period, from, to, yearMonth, departments: rows, bySessions: bySessions.map((r) => r.id), byMinutes: byMinutes.map((r) => r.id), unassigned }
}
