// v2.2 게임화 서버 계산 — 햇빛·나무·캐릭터·부서 정원
// 받은 햇빛·나무 단계·정원 진행은 모두 운동 기록에서 계산합니다(저장 안 함).
// 저장하는 것: 구매(쓴 햇빛), 장착, 피드 표시 여부, 정원 해금 기록.
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  addDays, dailyCredits, kstToday, loadLogs, readAllRows, weekStart,
} from './engagement'
import {
  CHARACTERS, characterByShopKey, CLOTHES, isClothes, UNIFORM_KEYS, SHOP_KEYS, clampSpot, computeRewards, decorByKey, decorFor, GARDEN_SIZE, GARDEN_SPOTS, Placed, GARDEN_DAYS_PER_PERSON, gameGoalForWeek, GoalChange, isCharacterKey, isNameEmoji, isOutfitKey, ITEMS, itemByKey, Reward, Equipped, Slot, SLOTS, treeStage,
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
    // 033·034(정원 배치 표·좌표 칸) 적용 전 DB 에서는 오류가 나므로 아래에서 '준비 안 됨'으로 넘깁니다(홈 나무가 같이 죽지 않게)
    db.from('garden_placements').select('item_key, slot, x, y').eq('employee_id', employeeId),
  ])
  const purchases = (buys ?? []) as Purchase[]
  const spent = purchases.reduce((s, p) => s + p.price, 0)
  const raw = e.earned - spent
  // 기록을 지워 받은 햇빛이 줄면 이미 산 아이템은 그대로 두고, 잔액은 0으로 보이며 모자란 만큼 다시 모아야 살 수 있습니다.
  const balance = Math.max(raw, 0)
  const shortfall = raw < 0 ? -raw : 0

  const ledger = [
    ...e.rewards.map((r: Reward) => ({ type: 'earn' as const, key: r.key, date: r.date, label: r.label, points: r.points })),
    ...purchases.map((p) => ({ type: 'spend' as const, key: `buy:${p.item_key}`, date: kstToday(new Date(p.purchased_at)), label: `${itemByKey(p.item_key)?.name ?? decorByKey(p.item_key)?.name ?? characterByShopKey(p.item_key)?.name ?? p.item_key} 구매`, points: -p.price })),
  ].sort((a, b) => (a.date === b.date ? (a.type === b.type ? a.key.localeCompare(b.key) : a.type === 'earn' ? -1 : 1) : a.date < b.date ? 1 : -1))

  const equipped = equippedFrom(equip)

  // 나의 정원: 가진 장식 + 놓은 자리(좌표). 목록에 없는 키는 내보내지 않음
  const garden = {
    ready: !placed.error, // false = 033·034 미적용(꾸미기 준비 중)
    owned: purchases.map((p) => p.item_key).filter((k) => !!decorByKey(k)),
    items: placedItems(placed.data),
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
    ownedCharacters: CHARACTERS.filter((c) => !c.shopKey || purchases.some((p) => p.item_key === c.shopKey)).map((c) => c.key), // 고를 수 있는 캐릭터(산 것 포함)
    outfitKey: isOutfitKey(prof?.outfit) ? prof.outfit : null, // null = 기본 의상(운동복). 035 전 DB 에서는 항상 null
    message: typeof prof?.status_message === 'string' ? prof.status_message : null, // 프로필 한마디(032 전 DB면 null)
  }
}

export async function purchaseItem(db: SupabaseClient, employeeId: string, itemKey: string) {
  const ch = characterByShopKey(itemKey) // 햇빛으로 사는 캐릭터(단발녀, 11-27 TK)
  const item = (SHOP_KEYS.has(itemKey) ? itemByKey(itemKey) : null) ?? decorByKey(itemKey) ?? (ch ? { key: ch.shopKey as string, price: ch.price } : null) // 지금 파는 옷(11-20 TK)·정원 장식·캐릭터
  if (!item) return { status: 'unknown_item' as const }
  const { earned } = await earnedFor(db, employeeId)
  const { data, error } = await db.rpc('game_purchase', { p_employee: employeeId, p_item: item.key, p_price: item.price, p_earned: earned })
  if (error) throw new Error('PURCHASE_FAILED')
  return data as { status: 'ok' | 'already_owned' | 'insufficient' | 'invalid'; balance?: number }
}

/** 정원 배치 줄 → 화면용 목록. 좌표가 없는 줄(옛 앱이 칸 번호로 놓은 것)은 칸 자리의 좌표로 */
function placedItems(rows: { item_key: string; slot: number | null; x: number | null; y: number | null }[] | null | undefined): Placed[] {
  const out: Placed[] = []
  for (const r of rows ?? []) {
    const d = decorByKey(r.item_key)
    if (!d) continue
    const spot = r.x != null && r.y != null ? { x: r.x, y: r.y } : r.slot != null ? GARDEN_SPOTS[r.slot] : null
    if (!spot) continue
    out.push({ key: r.item_key, ...clampSpot(d, spot.x, spot.y) })
  }
  return out.sort((a, b) => a.key.localeCompare(b.key))
}

/** 정원에 장식 놓기·옮기기(pos 지정)·빼기(pos null). 가진 장식만 — DB 함수가 직원별 잠금 안에서 처리 */
export async function placeDecor(db: SupabaseClient, employeeId: string, itemKey: string, pos: { x: number; y: number } | null) {
  const d = decorByKey(itemKey)
  if (!d) return { status: 'invalid' as const }
  if (pos) {
    // 화면이 보낸 값을 믿지 않음: 정수·범위 확인 + 그림이 정원 밖으로 나가지 않는 자리인지
    if (!Number.isInteger(pos.x) || !Number.isInteger(pos.y) || pos.x < 0 || pos.x > GARDEN_SIZE || pos.y < 0 || pos.y > GARDEN_SIZE) return { status: 'invalid' as const }
    const c = clampSpot(d, pos.x, pos.y)
    if (c.x !== pos.x || c.y !== pos.y) return { status: 'invalid' as const }
  }
  const { data, error } = await db.rpc('garden_put', { p_employee: employeeId, p_item: itemKey, p_x: pos ? pos.x : null, p_y: pos ? pos.y : null })
  if (error) {
    // 033·034 미적용(함수·표 없음)
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
    // 036 전 DB: 칸 검사가 hat·top·shoes 만 허용
    if (error.code === '23514') return { status: 'not_ready' as const }
    throw new Error('EQUIP_FAILED')
  }
  // 옷은 한 벌만(11-20 TK): 옷을 입으면 다른 옷 칸을 비움. 꾸미기를 입으면 유니폼만 벗김(운동복 계열에는 꾸미기가 보임)
  const q = db.from('game_equipment').delete().eq('employee_id', employeeId)
  const { error: e2 } = isClothes(slot) ? await q.in('slot', CLOTHES.filter((s) => s !== slot)) : await q.in('item_key', UNIFORM_KEYS)
  if (e2) throw new Error('EQUIP_FAILED')
  return { status: 'ok' as const }
}

/** 착용 줄 → 칸별 아이템. 목록에 없는 키(예전 이모지 아이템 등)나 칸이 맞지 않는 줄은 버림 */
function equippedFrom(rows: { slot: string; item_key: string }[] | null | undefined): Equipped {
  const out: Equipped = Object.fromEntries(SLOTS.map((s) => [s, null])) // 빈 칸은 null(화면·시험이 칸 이름으로 확인)
  for (const r of rows ?? []) {
    const it = itemByKey(r.item_key)
    if (it && it.slot === r.slot) out[it.slot] = it.key
  }
  return out
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
    const items = (equip ?? []).filter((e) => e.employee_id === id).map((e) => itemByKey(e.item_key)?.name).filter(Boolean) as string[]
    out[id] = { stage: treeStage(days.get(id)?.size ?? 0).stage, items, character: charOf.get(id) ?? null }
  }
  return out
}

/** 동료 프로필(피드에서 이름을 눌렀을 때) — 이모지·한마디, 캐릭터는 본인이 '보이기'를 켠 경우만 */
export async function peerProfile(db: SupabaseClient, employeeId: string) {
  const { data: p } = await db.from('game_profiles').select('*').eq('employee_id', employeeId).maybeSingle()
  // 정원 구경: 모든 직원(11-19 TK: 이름을 누르면 그 사람의 정원과 캐릭터가 나오게 — 공개 설정 없앰).
  // 나무 단계 이름과 놓인 장식만 — 운동한 날 수·햇빛·가진 장식 목록은 내보내지 않음
  let garden: { stage: number; stageName: string; items: Placed[] } | null = null
  let equipped: Equipped = {}
  {
    const [e, placed, eq] = await Promise.all([
      earnedFor(db, employeeId),
      db.from('garden_placements').select('item_key, slot, x, y').eq('employee_id', employeeId), // 033·034 전 DB 면 오류 → 빈 정원
      db.from('game_equipment').select('slot, item_key').eq('employee_id', employeeId),
    ])
    equipped = equippedFrom(eq.data)
    const t = treeStage(e.activeDays)
    garden = { stage: t.stage, stageName: t.name, items: placedItems(placed.data) }
  }
  return {
    garden,
    emoji: isNameEmoji(p?.name_emoji) ? (p.name_emoji as string) : null,
    showCharacter: true,
    character: isCharacterKey(p?.character) ? (p.character as string) : null, // 안 골랐으면 화면이 기본 캐릭터로 그림
    outfit: isOutfitKey(p?.outfit) ? (p.outfit as string) : null,
    equipped, // 입은 아이템(칸별). 가진 아이템 목록·햇빛은 내보내지 않음
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
