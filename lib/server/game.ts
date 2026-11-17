// v2.2 게임화 서버 계산 — 햇빛·나무·캐릭터·부서 정원
// 받은 햇빛·나무 단계·정원 진행은 모두 운동 기록에서 계산합니다(저장 안 함).
// 저장하는 것: 구매(쓴 햇빛), 장착, 피드 표시 여부, 정원 해금 기록.
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  addDays, dailyCredits, kstToday, loadLogs, readAllRows, weekStart,
} from './engagement'
import {
  computeRewards, decorByKey, decorFor, GARDEN_SLOTS, GARDEN_DAYS_PER_PERSON, gameGoalForWeek, GoalChange, isCharacterKey, isNameEmoji, ITEMS, itemByKey, Reward, Slot, treeStage,
} from '../game'

export async function launchDate(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.from('game_settings').select('launch_date').eq('id', 1).maybeSingle()
  if (error || !data) throw new Error('GAME_SETTINGS_MISSING')
  return data.launch_date as string
}

/** 한 직원이 받은 햇빛 목록과 도입일 이후 운동한 날 수 */
export async function earnedFor(db: SupabaseClient, employeeId: string, today = kstToday()) {
  const launch = await launchDate(db)
  const [logs, history] = await Promise.all([
    loadLogs(db, { employeeId, from: launch, to: today }),
    readAllRows<GoalChange>(() => db.from('personal_goal_history').select('id, kind, target, changed_at').eq('employee_id', employeeId), ['changed_at', 'id']),
  ])
  const credits = dailyCredits(logs)
  const rewards = computeRewards(
    credits.map((c) => ({ date: c.date, sessions: c.sessions, seconds: c.seconds })),
    history,
    launch,
    today
  )
  const earned = rewards.reduce((s, r) => s + r.points, 0)
  const thisWeek = weekStart(today)
  const wk = credits.filter((c) => c.date >= thisWeek && c.date >= launch && c.date <= today)
  const basis = gameGoalForWeek(history, thisWeek)
  const goalBasis = basis ? {
    ...basis,
    value: basis.kind === 'sessions' ? wk.reduce((s, c) => s + c.sessions, 0) : Math.floor(wk.reduce((s, c) => s + c.seconds, 0) / 60),
  } : null
  return { launch, rewards, earned, goalBasis, activeDays: credits.filter((c) => c.date >= launch && c.date <= today).length }
}

export interface Purchase { item_key: string; price: number; purchased_at: string }

/** 내 게임 현황(본인만) */
export async function myGame(db: SupabaseClient, employeeId: string, today = kstToday()) {
  const [e, { data: buys }, { data: equip }, { data: prof }, placed] = await Promise.all([
    earnedFor(db, employeeId, today),
    db.from('game_purchases').select('item_key, price, purchased_at').eq('employee_id', employeeId).order('purchased_at'),
    db.from('game_equipment').select('slot, item_key').eq('employee_id', employeeId),
    // '*' 로 읽어 029(character 칸) 적용 전 DB 에서도 오류 없이 동작
    db.from('game_profiles').select('*').eq('employee_id', employeeId).maybeSingle(),
    // 033(정원 배치 표) 적용 전 DB 에서는 오류가 나므로 아래에서 '준비 안 됨'으로 넘깁니다(홈 나무가 같이 죽지 않게)
    db.from('garden_placements').select('slot, item_key').eq('employee_id', employeeId),
  ])
  const purchases = (buys ?? []) as Purchase[]
  const spent = purchases.reduce((s, p) => s + p.price, 0)
  const raw = e.earned - spent
  // 기록을 지워 받은 햇빛이 줄면 이미 산 아이템은 그대로 두고, 잔액은 0으로 보이며 모자란 만큼 다시 모아야 살 수 있습니다.
  const balance = Math.max(raw, 0)
  const shortfall = raw < 0 ? -raw : 0

  const ledger = [
    ...e.rewards.map((r: Reward) => ({ type: 'earn' as const, key: r.key, date: r.date, label: r.label, points: r.points })),
    ...purchases.map((p) => ({ type: 'spend' as const, key: `buy:${p.item_key}`, date: kstToday(new Date(p.purchased_at)), label: `${itemByKey(p.item_key)?.name ?? decorByKey(p.item_key)?.name ?? p.item_key} 구매`, points: -p.price })),
  ].sort((a, b) => (a.date === b.date ? (a.type === b.type ? a.key.localeCompare(b.key) : a.type === 'earn' ? -1 : 1) : a.date < b.date ? 1 : -1))

  const equipped: Record<Slot, string | null> = { hat: null, top: null, shoes: null }
  for (const r of equip ?? []) equipped[r.slot as Slot] = r.item_key

  // 나의 정원: 가진 장식 + 칸별 배치(0~7). 목록에 없는 키는 내보내지 않음
  const slots: (string | null)[] = Array.from({ length: GARDEN_SLOTS }, () => null)
  for (const r of placed.data ?? []) if (r.slot >= 0 && r.slot < GARDEN_SLOTS && decorByKey(r.item_key)) slots[r.slot] = r.item_key
  const garden = {
    ready: !placed.error, // false = 033 미적용(꾸미기 준비 중)
    owned: purchases.map((p) => p.item_key).filter((k) => !!decorByKey(k)),
    slots,
  }

  return {
    today,
    launchDate: e.launch,
    sunlight: { earned: e.earned, spent, balance, shortfall },
    ledger,
    tree: treeStage(e.activeDays),
    goalBasis: e.goalBasis, // 이번 주 목표 보상 판정 기준(주 시작 목표)
    character: { owned: purchases.map((p) => p.item_key).filter((k) => !!itemByKey(k)), equipped },
    garden,
    showInFeed: prof?.show_in_feed ?? false,
    nameEmoji: (prof?.name_emoji as string | null) ?? null,
    characterKey: isCharacterKey(prof?.character) ? prof.character : null, // null = 아직 안 고름(기본 캐릭터)
    message: typeof prof?.status_message === 'string' ? prof.status_message : null, // 프로필 한마디(032 전 DB면 null)
  }
}

export async function purchaseItem(db: SupabaseClient, employeeId: string, itemKey: string) {
  const item = itemByKey(itemKey) ?? decorByKey(itemKey) // 캐릭터 아이템 또는 정원 장식
  if (!item) return { status: 'unknown_item' as const }
  const { earned } = await earnedFor(db, employeeId)
  const { data, error } = await db.rpc('game_purchase', { p_employee: employeeId, p_item: item.key, p_price: item.price, p_earned: earned })
  if (error) throw new Error('PURCHASE_FAILED')
  return data as { status: 'ok' | 'already_owned' | 'insufficient' | 'invalid'; balance?: number }
}

/** 정원 칸에 장식 놓기·옮기기·빼기(itemKey null = 그 칸 비우기). 가진 장식만 — DB 함수가 직원별 잠금 안에서 처리 */
export async function placeDecor(db: SupabaseClient, employeeId: string, slot: number, itemKey: string | null) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= GARDEN_SLOTS) return { status: 'invalid' as const }
  if (itemKey !== null && !decorByKey(itemKey)) return { status: 'invalid' as const }
  const { data, error } = await db.rpc('garden_place', { p_employee: employeeId, p_slot: slot, p_item: itemKey })
  if (error) {
    // 033 미적용(함수·표 없음)
    if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01' || error.code === 'PGRST205') return { status: 'not_ready' as const }
    if (error.code === '23503') return { status: 'not_owned' as const }
    throw new Error('PLACE_FAILED')
  }
  return data as { status: 'ok' | 'not_owned' | 'invalid' }
}

export async function setEquipment(db: SupabaseClient, employeeId: string, slot: Slot, itemKey: string | null) {
  if (itemKey === null) {
    const { error } = await db.from('game_equipment').delete().eq('employee_id', employeeId).eq('slot', slot)
    if (error) throw new Error('EQUIP_FAILED')
    return { status: 'ok' as const }
  }
  const item = itemByKey(itemKey)
  if (!item || item.slot !== slot) return { status: 'wrong_slot' as const }
  const { data: own } = await db.from('game_purchases').select('item_key').eq('employee_id', employeeId).eq('item_key', itemKey).maybeSingle()
  if (!own) return { status: 'not_owned' as const }
  const { error } = await db.from('game_equipment')
    .upsert({ employee_id: employeeId, slot, item_key: itemKey, updated_at: new Date().toISOString() }, { onConflict: 'employee_id,slot' })
  if (error) {
    // 구매 행이 없으면 DB 외래키가 막습니다(동시에 지워진 경우 등)
    if (error.code === '23503') return { status: 'not_owned' as const }
    throw new Error('EQUIP_FAILED')
  }
  return { status: 'ok' as const }
}

// ── 피드 표시(본인이 켠 직원만) ──
export async function feedLooks(db: SupabaseClient, ids: string[], today = kstToday()) {
  if (!ids.length) return {}
  const { data: profs } = await db.from('game_profiles').select('*').in('employee_id', ids).eq('show_in_feed', true)
  const on = (profs ?? []).map((p) => p.employee_id as string)
  const charOf = new Map((profs ?? []).map((p) => [p.employee_id as string, isCharacterKey(p.character) ? p.character : null]))
  if (!on.length) return {}
  const launch = await launchDate(db)
  const [logs, { data: equip }] = await Promise.all([
    readAllRows<{ employee_id: string; log_date: string }>(
      () => db.from('exercise_logs').select('id, employee_id, log_date').in('employee_id', on).gte('log_date', launch).lte('log_date', today), ['id']
    ),
    db.from('game_equipment').select('employee_id, slot, item_key').in('employee_id', on),
  ])
  const days = new Map<string, Set<string>>()
  for (const l of logs) days.set(l.employee_id, (days.get(l.employee_id) ?? new Set()).add(l.log_date))
  const out: Record<string, { stage: number; items: string[]; character: string | null }> = {}
  for (const id of on) {
    const items = (equip ?? []).filter((e) => e.employee_id === id).map((e) => itemByKey(e.item_key)?.emoji).filter(Boolean) as string[]
    out[id] = { stage: treeStage(days.get(id)?.size ?? 0).stage, items, character: charOf.get(id) ?? null }
  }
  return out
}

/** 동료 프로필(피드에서 이름을 눌렀을 때) — 이모지·한마디, 캐릭터는 본인이 '보이기'를 켠 경우만 */
export async function peerProfile(db: SupabaseClient, employeeId: string) {
  const { data: p } = await db.from('game_profiles').select('*').eq('employee_id', employeeId).maybeSingle()
  // 정원 구경(2단계): 공개를 켠 직원만. 나무 단계 이름과 놓인 장식만 — 운동한 날 수·햇빛·가진 장식 목록은 내보내지 않음
  let garden: { stage: number; stageName: string; slots: (string | null)[] } | null = null
  if (p?.show_in_feed === true) {
    const [e, placed] = await Promise.all([
      earnedFor(db, employeeId),
      db.from('garden_placements').select('slot, item_key').eq('employee_id', employeeId), // 033 전 DB 면 오류 → 빈 정원
    ])
    const slots: (string | null)[] = Array.from({ length: GARDEN_SLOTS }, () => null)
    for (const r of placed.data ?? []) if (r.slot >= 0 && r.slot < GARDEN_SLOTS && decorByKey(r.item_key)) slots[r.slot] = r.item_key
    const t = treeStage(e.activeDays)
    garden = { stage: t.stage, stageName: t.name, slots }
  }
  return {
    garden,
    emoji: isNameEmoji(p?.name_emoji) ? (p.name_emoji as string) : null,
    showCharacter: p?.show_in_feed === true,
    character: p?.show_in_feed === true && isCharacterKey(p?.character) ? (p.character as string) : null,
    message: typeof p?.status_message === 'string' ? (p.status_message as string) : null,
  }
}

/** 피드 이름 앞 이모지 — 고른 직원만. 나무 표시(show_in_feed)와는 따로 */
export async function feedEmojis(db: SupabaseClient, ids: string[]) {
  if (!ids.length) return {}
  const { data } = await db.from('game_profiles').select('employee_id, name_emoji').in('employee_id', ids).not('name_emoji', 'is', null)
  const out: Record<string, string> = {}
  for (const p of data ?? []) if (isNameEmoji(p.name_emoji)) out[p.employee_id as string] = p.name_emoji as string
  return out
}

// ── 부서 공동 정원 ──
type GardenStatus = 'ok' | 'no_headcount' | 'check_needed'
export interface GardenWeek {
  departmentId: string
  week: string
  contributions: number // 직원별 하루 최대 1 → 운동한 직원-날 수
  participants: number
  headcount: number | null
  status: GardenStatus
  goal: number | null
}

/**
 * 도입일이 낀 주부터 이번 주까지, 부서·주별 공동 진행을 계산합니다.
 * 기여 부서는 그날의 부서 이력으로 정합니다(부서를 옮기면 옮긴 날부터 새 부서에 기여).
 */
export async function gardenWeeks(db: SupabaseClient, today = kstToday()) {
  const launch = await launchDate(db)
  const firstWeek = weekStart(launch)
  const thisWeek = weekStart(today)
  const [logs, hist, { data: depts }, { data: heads }] = await Promise.all([
    loadLogs(db, { from: launch, to: today }),
    readAllRows<{ employee_id: string; department_id: string; start_date: string; end_date: string | null }>(
      () => db.from('employee_departments').select('employee_id, department_id, start_date, end_date'), ['employee_id', 'start_date']
    ),
    db.from('departments').select('id, name, sort_order').order('sort_order').order('name'),
    db.from('department_headcounts').select('department_id, year_month, headcount'),
  ])
  const deptOf = (employeeId: string, date: string): string | null => {
    for (const h of hist) if (h.employee_id === employeeId && h.start_date <= date && (!h.end_date || date < h.end_date)) return h.department_id
    return null
  }
  const head = new Map((heads ?? []).map((h) => [`${h.department_id}|${h.year_month}`, h.headcount as number]))

  // 부서·주 → 직원-날 집합
  const acc = new Map<string, { days: Set<string>; people: Set<string> }>()
  for (const c of dailyCredits(logs)) {
    const d = deptOf(c.employeeId, c.date)
    if (!d) continue
    const key = `${d}|${weekStart(c.date)}`
    const a = acc.get(key) ?? { days: new Set<string>(), people: new Set<string>() }
    a.days.add(`${c.employeeId}|${c.date}`)
    a.people.add(c.employeeId)
    acc.set(key, a)
  }

  const weeks: GardenWeek[] = []
  for (const d of depts ?? []) {
    for (let w = firstWeek; w <= thisWeek; w = addDays(w, 7)) {
      const a = acc.get(`${d.id}|${w}`)
      // 인원 기준 달은 그 주 월요일이 속한 달로 고정(주 중간에 달이 바뀌어도 목표가 흔들리지 않게)
      const headcount = head.get(`${d.id}|${w.slice(0, 7)}`) ?? null
      const participants = a?.people.size ?? 0
      const status: GardenStatus = !headcount ? 'no_headcount' : participants > headcount ? 'check_needed' : 'ok'
      weeks.push({
        departmentId: d.id, week: w, contributions: a?.days.size ?? 0, participants, headcount, status,
        goal: status === 'ok' ? headcount! * GARDEN_DAYS_PER_PERSON : null,
      })
    }
  }
  return { launch, thisWeek, departments: (depts ?? []) as { id: string; name: string }[], weeks, deptOf }
}

/** 정원 해금 기록을 현재 기록 기준으로 맞춥니다(달성 주는 추가, 기록 삭제로 깨진 주는 회수). 부서·주마다 1번(기본키). */
export async function syncGardenUnlocks(db: SupabaseClient, weeks: GardenWeek[]) {
  const want = weeks.filter((w) => w.goal !== null && w.contributions >= w.goal)
  const have = await readAllRows<{ department_id: string; week_start: string }>(
    () => db.from('garden_unlocks').select('department_id, week_start'), ['department_id', 'week_start']
  )
  const haveSet = new Set(have.map((h) => `${h.department_id}|${h.week_start}`))
  const wantSet = new Set(want.map((w) => `${w.departmentId}|${w.week}`))
  const add = want.filter((w) => !haveSet.has(`${w.departmentId}|${w.week}`))
  const remove = have.filter((h) => !wantSet.has(`${h.department_id}|${h.week_start}`))
  if (add.length) {
    const { error } = await db.from('garden_unlocks').upsert(
      add.map((w) => ({ department_id: w.departmentId, week_start: w.week, goal: w.goal! })),
      { onConflict: 'department_id,week_start', ignoreDuplicates: true }
    )
    if (error) throw new Error('GARDEN_SYNC_FAILED')
  }
  for (const r of remove) await db.from('garden_unlocks').delete().eq('department_id', r.department_id).eq('week_start', r.week_start)
  return { added: add.length, removed: remove.length }
}

async function unlocksOf(db: SupabaseClient, departmentId: string) {
  const { data, error } = await db.from('garden_unlocks').select('week_start, unlocked_at').eq('department_id', departmentId).order('week_start')
  if (error) throw new Error('GARDEN_READ_FAILED')
  return data ?? []
}

/** 내 부서 정원(본인 기준). 다른 직원 이름·미참여자는 내보내지 않고 숫자만. */
export async function myGarden(db: SupabaseClient, employeeId: string, today = kstToday()) {
  const g = await gardenWeeks(db, today)
  await syncGardenUnlocks(db, g.weeks)
  const deptId = g.deptOf(employeeId, today)
  if (!deptId) return { today, department: null }
  const dept = g.departments.find((d) => d.id === deptId)!
  const cur = g.weeks.find((w) => w.departmentId === deptId && w.week === g.thisWeek)!
  const mine = await unlocksOf(db, deptId)
  return {
    today,
    department: { id: dept.id, name: dept.name },
    week: { start: g.thisWeek, end: addDays(g.thisWeek, 6), contributions: cur.contributions, participants: cur.participants, goal: cur.goal, status: cur.status, achieved: cur.goal !== null && cur.contributions >= cur.goal },
    decorations: mine.map((u, i) => ({ week: u.week_start as string, ...decorFor(i) })),
  }
}

/** 관리자 안내: 이번 주 공동 목표를 정할 수 없는 부서(인원 정보 없음·불일치) */
export async function gardenAdminNotices(db: SupabaseClient, today = kstToday()) {
  const g = await gardenWeeks(db, today)
  return g.weeks
    .filter((w) => w.week === g.thisWeek && w.status !== 'ok')
    .map((w) => ({ departmentId: w.departmentId, name: g.departments.find((d) => d.id === w.departmentId)?.name ?? '', status: w.status, participants: w.participants, headcount: w.headcount }))
}

export { ITEMS }
