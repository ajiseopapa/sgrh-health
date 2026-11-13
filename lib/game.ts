// v2.2 게임화 — 화면과 서버가 같이 쓰는 규칙(계산만, DB 접근 없음)
//
// 햇빛 보상 (PM v2.2 지시서 P1)
//  · 운동한 날(하루 첫 기록)마다 10 — 하루에 여러 번 기록해도 1번
//  · 한 주(월~일)에 운동한 날이 3일 이상이면 20 — 주마다 1번
//  · 그 주의 개인 목표를 달성하면 20 — 주마다 1번(목표를 바꿔도 키가 같은 주라 중복 없음)
//    판정 목표 = 그 주가 시작될 때(월 0시) 적용 중이던 목표. 그 주에 처음 정했다면 처음 정한 목표.
//    주중에 낮추거나 높여도 그 주 판정은 그대로 → 낮춰서 받기·높여서 회수·중복 모두 없음. 다음 주부터 새 목표.
//  · 도입일 이전 기록은 세지 않음(소급 없음). 도입일이 낀 주는 도입일부터 센 기록으로 판정.
//  · 받은 햇빛은 저장하지 않고 기록에서 계산 → 기록 수정·삭제 시 자동 재계산.

export const SUN_DAY = 10
export const SUN_WEEK3 = 20
export const SUN_GOAL = 20
export const WEEK3_DAYS = 3

// ── 나무: 도입일 이후 운동한 날 수로 4단계. 쉬어도 줄지 않음(누적) ──
export const TREE_STAGES = [
  { stage: 1, name: '새싹', from: 0 },
  { stage: 2, name: '어린 나무', from: 5 },
  { stage: 3, name: '나무', from: 15 },
  { stage: 4, name: '큰 나무', from: 30 },
] as const
export function treeStage(activeDays: number) {
  let cur: (typeof TREE_STAGES)[number] = TREE_STAGES[0]
  for (const s of TREE_STAGES) if (activeDays >= s.from) cur = s
  const next = TREE_STAGES.find((s) => s.from > activeDays) ?? null
  return { stage: cur.stage, name: cur.name, activeDays, next: next ? { stage: next.stage, name: next.name, at: next.from, remaining: next.from - activeDays } : null }
}

// ── 캐릭터 꾸미기: 아이템 6종(모자·상의·운동화). 모양만 바뀌고 능력 효과 없음 ──
export type Slot = 'hat' | 'top' | 'shoes'
export interface Item { key: string; slot: Slot; name: string; emoji: string; price: number }
export const ITEMS: Item[] = [
  { key: 'hat_cap', slot: 'hat', name: '러닝 캡', emoji: '🧢', price: 30 },
  { key: 'hat_straw', slot: 'hat', name: '정원 밀짚모자', emoji: '👒', price: 50 },
  { key: 'top_singlet', slot: 'top', name: '러닝 셔츠', emoji: '🎽', price: 40 },
  { key: 'top_jacket', slot: 'top', name: '바람막이', emoji: '🧥', price: 60 },
  { key: 'shoes_run', slot: 'shoes', name: '러닝화', emoji: '👟', price: 30 },
  { key: 'shoes_hike', slot: 'shoes', name: '등산화', emoji: '🥾', price: 50 },
]
export const SLOT_LABEL: Record<Slot, string> = { hat: '모자', top: '상의', shoes: '운동화' }
/** 캐릭터(아이템 해금·장착) 화면 노출. 11-13 TK 결정으로 숨김 — 디자이너 그림이 오면 true. 서버 기능·DB는 그대로 둠 */
export const SHOW_CHARACTER = false

/** 피드 이름 앞 이모지 — 본인이 고름(정해진 목록만, 서버가 확인). 사람 모양 이모지는 피부색 차이가 없는 것만 */
export const NAME_EMOJIS = [
  '😀', '😄', '😊', '🙂', '😎', '🤓', '🥳', '🤩', '😆', '😇', '🥰', '😤',
  '🏃', '🚶', '🚴', '🏊', '🧘', '🏋️', '⚽', '🏸',
  '🎾', '⛰️', '🌱', '🌳', '🔥', '💪', '⭐', '☀️',
  '🌈', '🍀', '🐢', '🐰', '🐻', '🐯', '🦊', '🐳',
] as const
export function isNameEmoji(v: unknown): v is string {
  return typeof v === 'string' && (NAME_EMOJIS as readonly string[]).includes(v)
}

export const DEFAULT_LOOK = { head: '🙂', top: '👕' } // 기본 캐릭터 1종(아이템 없을 때)
export function itemByKey(key: string | null | undefined): Item | null {
  return ITEMS.find((i) => i.key === key) ?? null
}

// ── 보상 계산 ──
export interface Reward { key: string; kind: 'day' | 'week3' | 'goal'; date: string; points: number; label: string }

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function weekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  return addDays(date, -((dow + 6) % 7))
}

export interface DayInput { date: string; sessions: number; seconds: number }
export interface GoalInput { kind: 'sessions' | 'minutes'; target: number }
export interface GoalChange { kind: 'sessions' | 'minutes'; target: number; changed_at: string }

/** 한국 시간 그 날 0시의 시각(ms) */
export function kstMidnight(date: string): number {
  return Date.parse(`${date}T00:00:00+09:00`)
}
/** 게임 보상 판정용 그 주 목표: 월 0시 이전 마지막 변경, 없으면 그 주 안의 첫 변경 */
export function gameGoalForWeek(history: GoalChange[], week: string): GoalInput | null {
  const start = kstMidnight(week)
  const end = start + 7 * 86400000
  let before: GoalChange | null = null
  let firstIn: GoalChange | null = null
  for (const h of history) {
    const t = Date.parse(h.changed_at)
    if (t < start) { if (!before || t >= Date.parse(before.changed_at)) before = h }
    else if (t < end) { if (!firstIn || t < Date.parse(firstIn.changed_at)) firstIn = h }
  }
  const g = before ?? firstIn
  return g ? { kind: g.kind, target: g.target } : null
}

/**
 * 받은 햇빛 목록. days = 한 직원의 날짜별 묶음(하루 300분 상한 적용된 인정 시간).
 * goalHistory = 목표 변경 이력(게임 판정은 그 주 시작 목표 기준, gameGoalForWeek).
 */
export function computeRewards(
  days: DayInput[],
  goalHistory: GoalChange[],
  launchDate: string,
  today: string
): Reward[] {
  const counted = days.filter((d) => d.date >= launchDate && d.date <= today)
  const out: Reward[] = []
  for (const d of counted) out.push({ key: `day:${d.date}`, kind: 'day', date: d.date, points: SUN_DAY, label: '운동한 날' })

  const byWeek = new Map<string, DayInput[]>()
  for (const d of counted) {
    const w = weekStart(d.date)
    byWeek.set(w, [...(byWeek.get(w) ?? []), d])
  }
  for (const [w, list] of byWeek) {
    const lastDate = list.map((d) => d.date).sort().at(-1)!
    if (list.length >= WEEK3_DAYS) {
      // 세 번째 운동한 날에 받은 것으로 표시
      const third = list.map((d) => d.date).sort()[WEEK3_DAYS - 1]
      out.push({ key: `week3:${w}`, kind: 'week3', date: third, points: SUN_WEEK3, label: '주 3일 운동' })
    }
    const g = gameGoalForWeek(goalHistory, w)
    if (g) {
      const value = g.kind === 'sessions'
        ? list.reduce((s, d) => s + d.sessions, 0)
        : Math.floor(list.reduce((s, d) => s + d.seconds, 0) / 60)
      if (value >= g.target) out.push({ key: `goal:${w}`, kind: 'goal', date: lastDate, points: SUN_GOAL, label: '주간 목표 달성' })
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.key.localeCompare(b.key) : a.date < b.date ? -1 : 1))
}

// ── 부서 공동 정원 ──
// 주간 공동 목표 = 그 달 인사팀 확인 인원 × 1일 ("부서 인원 수만큼 운동한 날이 모이면")
// 인원 정보가 없거나, 참여 인원이 인사팀 인원보다 많으면(자료 불일치) 목표를 정하지 않습니다.
export const GARDEN_DAYS_PER_PERSON = 1
export const GARDEN_DECOR = [
  { emoji: '🌷', name: '튤립' },
  { emoji: '🌳', name: '나무' },
  { emoji: '🪑', name: '벤치' },
  { emoji: '🌻', name: '해바라기' },
  { emoji: '⛲', name: '분수' },
  { emoji: '🌼', name: '들꽃' },
  { emoji: '🍎', name: '사과나무' },
  { emoji: '🏮', name: '정원 등' },
] as const
export function decorFor(index: number) {
  return GARDEN_DECOR[index % GARDEN_DECOR.length]
}
