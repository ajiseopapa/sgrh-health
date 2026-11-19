// v2.2 게임화 자동 시험 — ⚠️ 시험 DB에 연결된 로컬 서버에서만 (운영 주소면 실행 거부)
//
// 사용법: node scripts/v22-test.mjs http://localhost:3576 .env.local [p1|p2|p3|all]
//
// 사번 G로 시작하는 시험 직원, '시험v22-' 부서를 만들고 끝나면 모두 지웁니다.
// 도입일(game_settings.launch_date)은 시험 동안만 지난주 월요일로 바꾸고 끝나면 원래 값으로 되돌립니다.
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './backup.mjs'

const [base, envFile, only = 'all'] = process.argv.slice(2)
if (!base?.startsWith('http://localhost') || !envFile) {
  console.error('사용법: node scripts/v22-test.mjs http://localhost:<포트> <시험 env 파일> [p1|p2|p3|all]')
  process.exit(1)
}
const env = loadEnv(envFile)
if (env.NEXT_PUBLIC_SUPABASE_URL.includes('xambccrcircnlbnuhfcw')) { console.error('운영 DB 주소입니다. 시험 DB에서만 실행합니다.'); process.exit(1) }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

let pass = 0, total = 0
const fails = []
const check = (name, ok, detail = '') => {
  total++
  if (ok) pass++
  else fails.push(name)
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const section = (t) => console.log(`\n── ${t} ──`)

class Device {
  constructor() { this.jar = new Map() }
  async call(path, { method = 'GET', body } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'x-sgrh-request': '1',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.jar.size ? { Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair, ...attrs] = c.split(';')
      const [k, v] = pair.split('=')
      if (!v || attrs.some((a) => /max-age=0/i.test(a))) this.jar.delete(k.trim())
      else this.jar.set(k.trim(), v.trim())
    }
    return { status: res.status, ...(await res.json().catch(() => ({}))) }
  }
}

// ── 날짜 (한국 시간) ──
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
const add = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const MON = add(TODAY, -((new Date(`${TODAY}T00:00:00Z`).getUTCDay() + 6) % 7))
const LAUNCH = add(MON, -7) // 시험용 도입일: 지난주 월요일
const months = [...new Set([LAUNCH.slice(0, 7), add(LAUNCH, 6).slice(0, 7), MON.slice(0, 7), add(MON, 6).slice(0, 7), TODAY.slice(0, 7)])]

let originalLaunch = null
async function cleanup() {
  const { data: old } = await db.from('employees').select('id').like('employee_number', 'G%')
  if (old?.length) {
    const ids = old.map((e) => e.id)
    await db.from('employee_departments').delete().in('employee_id', ids)
    await db.from('employees').delete().in('id', ids)
  }
  const { data: dp } = await db.from('departments').select('id').like('name', '시험v22-%')
  if (dp?.length) {
    await db.from('employee_departments').delete().in('department_id', dp.map((d) => d.id))
    await db.from('departments').delete().in('id', dp.map((d) => d.id))
  }
}

let typeId
async function addLog(empId, date, seconds = 1800) {
  const { data, error } = await db.from('exercise_logs')
    .insert({ employee_id: empId, exercise_type_id: typeId, log_date: date, duration_seconds: seconds, memo: '시험v22' })
    .select('id').single()
  if (error) throw new Error(error.message)
  return data.id
}

const admin = new Device()
const nobody = new Device()
const dev = {}
const E = {}
const PINS = { G001: '583921', G002: '692047', G003: '470385', G004: '815263', G005: '362918', G006: '908172', G007: '246813' }
async function makeEmployees() {
  const { data, error } = await db.from('employees')
    .insert(Object.keys(PINS).map((n, i) => ({ name: `v22시험${i + 1}`, employee_number: n, created_at: '2026-10-01T00:00:00+09:00' })))
    .select('id, employee_number')
  if (error) throw new Error(error.message)
  for (const e of data) E[e.employee_number] = e.id
  await admin.call('/api/verify-admin', { method: 'POST', body: { password: env.ADMIN_PASSWORD } })
  for (const k of Object.keys(PINS)) {
    const r = await admin.call('/api/admin/pins', { method: 'POST', body: { mode: 'reset', employeeId: E[k] } })
    const temp = r.issued?.[0]?.pin
    dev[k] = new Device()
    await dev[k].call('/api/auth/login', { method: 'POST', body: { employeeId: E[k], pin: temp } })
    const c = await dev[k].call('/api/auth/change-pin', { method: 'POST', body: { currentPin: temp, newPin: PINS[k] } })
    if (!c.ok) throw new Error(`${k} PIN 변경 실패: ${c.message}`)
  }
}
const game = (k) => dev[k].call('/api/me/game')
const buy = (k, item, extra = {}) => dev[k].call('/api/me/game/purchase', { method: 'POST', body: { item, ...extra } })
const equip = (k, slot, item) => dev[k].call('/api/me/game/equip', { method: 'PUT', body: { slot, item } })

// ═════════ P1. 개인 나무와 햇빛 ═════════
async function p1() {
  section('P1-1. 하루 첫 기록 보상 (하루 1번)')
  let r = await game('G001')
  check('기록 없으면 햇빛 0, 나무 1단계(새싹)', r.ok && r.sunlight?.earned === 0 && r.tree?.stage === 1, `${r.sunlight?.earned} / ${r.tree?.name}`)
  check('도입일이 응답에 들어감', r.launchDate === LAUNCH, r.launchDate)
  await addLog(E.G001, add(LAUNCH, -1)) // 도입일 전날
  await addLog(E.G001, add(LAUNCH, -3))
  r = await game('G001')
  check('도입일 이전 기록은 보상 없음(소급 없음)', r.sunlight?.earned === 0 && r.tree?.activeDays === 0, `${r.sunlight?.earned}`)
  const d1 = [await addLog(E.G001, LAUNCH), await addLog(E.G001, LAUNCH), await addLog(E.G001, LAUNCH)]
  r = await game('G001')
  check('같은 날 기록 3건 → 햇빛 10 (1번만)', r.sunlight?.earned === 10, `${r.sunlight?.earned}`)
  check('사용 내역에 "운동한 날" 1줄', r.ledger?.filter((l) => l.key === `day:${LAUNCH}`).length === 1)
  await Promise.all(Array.from({ length: 6 }, () => game('G001')))
  r = await game('G001')
  check('동시 조회 6번 뒤에도 햇빛 10 그대로', r.sunlight?.earned === 10)

  section('P1-2. 주 3일 운동 보상')
  await addLog(E.G001, add(LAUNCH, 1))
  r = await game('G001')
  check('주 2일 → 20 (보너스 없음)', r.sunlight?.earned === 20, `${r.sunlight?.earned}`)
  const third = await addLog(E.G001, add(LAUNCH, 2))
  r = await game('G001')
  check('주 3일 → 30 + 보너스 20 = 50', r.sunlight?.earned === 50, `${r.sunlight?.earned}`)
  await addLog(E.G001, add(LAUNCH, 3))
  await addLog(E.G001, add(LAUNCH, 4))
  r = await game('G001')
  check('주 5일이어도 주 3일 보너스는 1번 (50+20=70)', r.sunlight?.earned === 70 && r.ledger?.filter((l) => l.key.startsWith('week3:')).length === 1, `${r.sunlight?.earned}`)

  section('P1-3. 기록 수정·삭제 → 재계산')
  // 지난주 기록 3건 지우면 2일만 남아 주 3일 보너스 회수
  await db.from('exercise_logs').delete().eq('employee_id', E.G001).in('log_date', [add(LAUNCH, 2), add(LAUNCH, 3), add(LAUNCH, 4)])
  r = await game('G001')
  check('기록 삭제 → 운동한 날 2일, 보너스 회수 (20)', r.sunlight?.earned === 20 && !r.ledger?.some((l) => l.key.startsWith('week3:')), `${r.sunlight?.earned}`)
  // 같은 날 3건 중 2건 삭제 → 여전히 10
  await dev.G001.call(`/api/logs/${d1[0]}`, { method: 'DELETE' })
  await dev.G001.call(`/api/logs/${d1[1]}`, { method: 'DELETE' })
  r = await game('G001')
  check('같은 날 기록이 1건 남으면 그날 보상 유지 (20)', r.sunlight?.earned === 20, `${r.sunlight?.earned}`)
  // 남은 1건 날짜를 도입일 전으로 고치면 그날 보상 사라짐
  const pr = await dev.G001.call(`/api/logs/${d1[2]}`, { method: 'PATCH', body: { exerciseTypeId: typeId, logDate: add(LAUNCH, -2), durationSeconds: 1800, distanceKm: null, memo: '시험v22' } })
  r = await game('G001')
  check('기록 날짜를 도입일 전으로 수정 → 그날 보상 회수 (10)', pr.ok && r.sunlight?.earned === 10, `${pr.status} ${r.sunlight?.earned}`)
  void third

  section('P1-4. 개인 주간 목표 보상 (목표를 바꿔도 중복 없음)')
  r = await dev.G002.call('/api/me/goal', { method: 'PUT', body: { kind: 'sessions', target: 2 } })
  check('이번 주 목표 2회 설정', r.ok)
  await addLog(E.G002, TODAY)
  r = await game('G002')
  check('1회 → 목표 보상 없음 (10)', r.sunlight?.earned === 10, `${r.sunlight?.earned}`)
  const g2 = await addLog(E.G002, TODAY)
  r = await game('G002')
  check('2회 달성 → +20 (30)', r.sunlight?.earned === 30 && r.ledger?.some((l) => l.key === `goal:${MON}`), `${r.sunlight?.earned}`)
  await dev.G002.call('/api/me/goal', { method: 'PUT', body: { kind: 'sessions', target: 1 } })
  await dev.G002.call('/api/me/goal', { method: 'PUT', body: { kind: 'minutes', target: 30 } })
  r = await game('G002')
  check('목표를 두 번 바꿔도 이번 주 목표 보상은 1번 (30)', r.sunlight?.earned === 30 && r.ledger?.filter((l) => l.key.startsWith('goal:')).length === 1, `${r.sunlight?.earned}`)
  await dev.G002.call('/api/me/goal', { method: 'PUT', body: { kind: 'sessions', target: 5 } })
  r = await game('G002')
  check('주중에 목표를 올려도 이미 받은 보상은 회수하지 않음 (30)', r.sunlight?.earned === 30, `${r.sunlight?.earned}`)
  const eng2 = await dev.G002.call('/api/me/engagement')
  check('v2.1 목표 화면은 바꾼 목표(5회) 그대로 표시', eng2.goal?.target === 5, `${eng2.goal?.target}`)
  await dev.G002.call('/api/me/goal', { method: 'PUT', body: { kind: 'sessions', target: 2 } })
  r = await game('G002')
  check('다시 낮춰도 중복 없음 (30)', r.sunlight?.earned === 30, `${r.sunlight?.earned}`)
  await dev.G002.call(`/api/logs/${g2}`, { method: 'DELETE' })
  r = await game('G002')
  check('기록 삭제로 목표 미달 → 목표 보상 회수 (10)', r.sunlight?.earned === 10, `${r.sunlight?.earned}`)

  section('P1-4b. 주중 목표 변경 → 게임 보상은 그 주 시작 목표 기준')
  {
    const MON0 = `${MON}T00:00:00+09:00`
    const at = (ms) => new Date(Date.parse(MON0) + ms).toISOString()
    const setHist = async (rows) => {
      await db.from('personal_goal_history').delete().eq('employee_id', E.G007)
      if (rows.length) await db.from('personal_goal_history').insert(rows.map(([kind, target, changed_at]) => ({ employee_id: E.G007, kind, target, changed_at })))
    }
    await db.from('exercise_logs').delete().eq('employee_id', E.G007)
    // 지난 일요일 23:59:59 에 3회 → 이번 주 시작 목표 3회. 주중(지금)에 1회로 낮춤
    await setHist([['sessions', 3, at(-1000)]])
    r = await dev.G007.call('/api/me/goal', { method: 'PUT', body: { kind: 'sessions', target: 1 } })
    const { count: hc } = await db.from('personal_goal_history').select('id', { count: 'exact', head: true }).eq('employee_id', E.G007)
    check('목표를 바꿀 때마다 서버가 변경 이력 1줄 기록', r.ok && hc === 2, `${hc}줄`)
    const t1 = await addLog(E.G007, TODAY)
    r = await game('G007')
    check('낮춘 목표(1회)를 채워도 그 주 보상 없음 — 기준은 주 시작 목표 3회 (10)', r.sunlight?.earned === 10 && r.goalBasis?.target === 3, `${r.sunlight?.earned} 기준 ${r.goalBasis?.target}`)
    const e7 = await dev.G007.call('/api/me/engagement')
    check('v2.1 달성률 화면은 낮춘 목표 1/1 그대로 표시', e7.goal?.target === 1 && e7.goal?.value === 1)
    const t2 = await addLog(E.G007, TODAY); const t3 = await addLog(E.G007, TODAY)
    r = await game('G007')
    check('주 시작 목표 3회를 채우면 +20 (30)', r.sunlight?.earned === 30 && r.ledger?.filter((l) => l.key === `goal:${MON}`).length === 1, `${r.sunlight?.earned}`)
    for (const body of [{ kind: 'sessions', target: 6 }, { kind: 'minutes', target: 30 }, { kind: 'sessions', target: 1 }, { kind: 'sessions', target: 9 }, { kind: 'sessions', target: 2 }]) {
      await dev.G007.call('/api/me/goal', { method: 'PUT', body })
    }
    r = await game('G007')
    check('반복 변경 5번(올리기·내리기·종류 변경) 뒤에도 기준 3회·보상 1번 그대로 (30)', r.sunlight?.earned === 30 && r.goalBasis?.target === 3 && r.ledger?.filter((l) => l.key.startsWith('goal:')).length === 1, `${r.sunlight?.earned}`)
    // 기록 수정·삭제는 다시 계산
    await dev.G007.call(`/api/logs/${t3}`, { method: 'DELETE' })
    r = await game('G007')
    check('기록 삭제로 기준 미달(2/3) → 목표 보상 회수 (10)', r.sunlight?.earned === 10, `${r.sunlight?.earned}`)
    const back = await addLog(E.G007, TODAY)
    r = await game('G007')
    check('다시 채우면 1번만 (30)', r.sunlight?.earned === 30)
    const pe = await dev.G007.call(`/api/logs/${back}`, { method: 'PATCH', body: { exerciseTypeId: typeId, logDate: add(MON, -1), durationSeconds: 1800, distanceKm: null, memo: '시험v22' } })
    r = await game('G007')
    check('기록 날짜를 지난주로 수정 → 이번 주 2회로 미달, 회수 (지난주 1일 +10 → 20)', pe.ok && !r.ledger?.some((l) => l.key === `goal:${MON}`) && r.sunlight?.earned === 20, `${r.sunlight?.earned}`)
    void t1; void t2

    section('P1-4c. 경계 시각 · 다음 주 적용')
    await db.from('exercise_logs').delete().eq('employee_id', E.G007)
    // 월요일 0시 정각 변경 = 그 주 안의 변경. 그 전 목표가 없으면 그 주 첫 변경(4회)이 기준
    await setHist([['sessions', 4, at(0)], ['sessions', 1, at(3600 * 1000)]])
    r = await game('G007')
    check('월 0시 정각에 처음 정한 목표(4회)가 그 주 기준, 1시간 뒤 낮춘 1회는 무시', r.goalBasis?.target === 4, `${r.goalBasis?.target}`)
    await setHist([['sessions', 5, at(-1000)], ['sessions', 4, at(0)]])
    r = await game('G007')
    check('일요일 23:59:59 목표(5회)가 있으면 월 0시 정각 변경(4회)보다 우선', r.goalBasis?.target === 5, `${r.goalBasis?.target}`)
    // 지난주: 주 시작 전 5회, 지난주 수요일에 1회로 낮춤 → 지난주 기준 5회, 이번 주 기준 1회
    const lastMon0 = Date.parse(MON0) - 7 * 86400000
    await setHist([['sessions', 5, new Date(lastMon0 - 3600 * 1000).toISOString()], ['sessions', 1, new Date(lastMon0 + 2 * 86400000).toISOString()]])
    await addLog(E.G007, add(MON, -5)) // 지난주 수요일 1회
    await addLog(E.G007, TODAY)
    r = await game('G007')
    check('지난주는 변경 전 목표(5회)로 판정 → 1회라 보상 없음', !r.ledger?.some((l) => l.key === `goal:${add(MON, -7)}`))
    check('낮춘 목표(1회)는 다음 주(이번 주)부터 적용 → 이번 주 +20', r.goalBasis?.target === 1 && r.ledger?.some((l) => l.key === `goal:${MON}`), `기준 ${r.goalBasis?.target}`)
    await db.from('exercise_logs').delete().eq('employee_id', E.G007)
    await db.from('personal_goal_history').delete().eq('employee_id', E.G007)
  }

  section('P1-5. 나무 4단계 (누적 활동일, 쉬어도 그대로)')
  // G006: 도입일부터 이어서 N일 (오늘까지 가능한 날만)
  const span = Math.min(30, (Date.parse(TODAY) - Date.parse(LAUNCH)) / 86400000 + 1)
  const rows = Array.from({ length: span }, (_, i) => ({ employee_id: E.G006, exercise_type_id: typeId, log_date: add(LAUNCH, i), duration_seconds: 600, memo: '시험v22' }))
  await db.from('exercise_logs').insert(rows.slice(0, 4))
  r = await game('G006')
  check('4일 → 1단계 새싹, 다음 단계까지 1일', r.tree?.stage === 1 && r.tree?.next?.remaining === 1, `${r.tree?.name} ${r.tree?.next?.remaining}`)
  await db.from('exercise_logs').insert(rows.slice(4, 5))
  r = await game('G006')
  check('5일 → 2단계 어린 나무', r.tree?.stage === 2, r.tree?.name)
  check('운동을 쉬어도(최근 기록 없음) 단계 유지', r.tree?.stage === 2)
  // 3·4단계: 이 부분만 도입일을 40일 전으로 당겨 G006에 날짜를 더 채움
  const far = add(TODAY, -40)
  await db.from('game_settings').update({ launch_date: far }).eq('id', 1)
  await db.from('exercise_logs').delete().eq('employee_id', E.G006)
  const longRows = Array.from({ length: 30 }, (_, i) => ({ employee_id: E.G006, exercise_type_id: typeId, log_date: add(far, i), duration_seconds: 600, memo: '시험v22' }))
  await db.from('exercise_logs').insert(longRows.slice(0, 14))
  r = await game('G006')
  check('14일 → 2단계', r.tree?.stage === 2, r.tree?.name)
  await db.from('exercise_logs').insert(longRows.slice(14, 15))
  r = await game('G006')
  check('15일 → 3단계 나무', r.tree?.stage === 3, r.tree?.name)
  await db.from('exercise_logs').insert(longRows.slice(15, 29))
  r = await game('G006')
  check('29일 → 3단계', r.tree?.stage === 3 && r.tree?.next?.remaining === 1, `${r.tree?.name} ${r.tree?.next?.remaining}`)
  await db.from('exercise_logs').insert(longRows.slice(29, 30))
  r = await game('G006')
  check('30일 → 4단계 큰 나무, 다음 단계 없음', r.tree?.stage === 4 && r.tree?.next === null, r.tree?.name)
  await db.from('game_settings').update({ launch_date: LAUNCH }).eq('id', 1)
  await db.from('exercise_logs').delete().eq('employee_id', E.G006)

  section('P1-6. 접근 차단 (본인만)')
  r = await nobody.call('/api/me/game')
  check('로그인 없이 내 햇빛 조회 거부', r.status === 401)
  r = await dev.G002.call(`/api/me/game?employeeId=${E.G001}`)
  check('다른 직원 ID를 붙여도 본인(G002) 현황만', r.ok && r.sunlight?.earned === 10)
  for (const t of ['game_settings', 'game_purchases', 'game_equipment', 'game_profiles', 'garden_unlocks', 'personal_goal_history']) {
    const { data, error } = await anon.from(t).select('*').limit(1)
    check(`공개 키로 ${t} 읽기 차단`, !!error || (data ?? []).length === 0, error?.code ?? '')
  }
  const { error: rpcErr } = await anon.rpc('game_purchase', { p_employee: E.G001, p_item: 'hat_hairband', p_price: 1, p_earned: 9999 })
  check('공개 키로 구매 함수 직접 실행 차단', !!rpcErr, rpcErr?.code)
  const { error: insErr } = await anon.from('game_purchases').insert({ employee_id: E.G001, item_key: 'hat_hairband', price: 1 })
  check('공개 키로 구매 행 직접 쓰기 차단', !!insErr)
}

// ═════════ P2. 캐릭터 꾸미기 ═════════
async function p2() {
  // G003: 도입일 주 3일 + 이번 주 2일 → 10×5 + 20 = 70
  for (const d of [LAUNCH, add(LAUNCH, 1), add(LAUNCH, 2)]) await addLog(E.G003, d)
  const recent = [await addLog(E.G003, TODAY)]
  if (TODAY !== add(LAUNCH, 7)) recent.push(await addLog(E.G003, add(TODAY, -1) >= MON ? add(TODAY, -1) : TODAY))
  let r = await game('G003')
  const earned = r.sunlight?.earned
  check('P2 준비: 햇빛 60 이상', earned >= 60, `${earned}`)

  section('P2-1. 해금 (서버 잔액 확인)')
  r = await buy('G003', 'back_greenbackpack', { price: 1 })
  const afterJacket = r.game?.sunlight?.balance
  check('화면이 보낸 가격은 무시하고 서버 가격(60)으로 차감', r.ok && afterJacket === earned - 60, `${earned} → ${afterJacket}`)
  r = await buy('G003', 'back_greenbackpack')
  check('같은 아이템 다시 구매 → 거부 (이미 가짐)', r.status === 409 && r.code === 'already_owned')
  r = await buy('G003', 'hat_baseballcap')
  check('햇빛 모자람 → 거부', afterJacket < 50 ? r.status === 409 && r.code === 'insufficient' : r.ok, `잔액 ${afterJacket}`)
  r = await buy('G003', 'wings_gold')
  check('없는 아이템 → 거부', r.status === 400)
  r = await nobody.call('/api/me/game/purchase', { method: 'POST', body: { item: 'hat_hairband' } })
  check('로그인 없이 구매 거부', r.status === 401)
  const csrf = await fetch(base + '/api/me/game/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: [...dev.G003.jar].map(([k, v]) => `${k}=${v}`).join('; ') }, body: '{"item":"hat_hairband"}' })
  check('전용 헤더 없는 요청(CSRF) 거부', csrf.status === 403)

  section('P2-2. 동시 구매')
  // G004: 정확히 70 → 동시에 6개 아이템(합계 260) 요청 → 쓴 햇빛 ≤ 70
  for (const d of [LAUNCH, add(LAUNCH, 1), add(LAUNCH, 2), add(LAUNCH, 3), add(LAUNCH, 4)]) await addLog(E.G004, d)
  r = await game('G004')
  check('G004 햇빛 70', r.sunlight?.earned === 70, `${r.sunlight?.earned}`)
  const all = await Promise.all(['hat_hairband', 'hat_baseballcap', 'face_sunglasses', 'back_greenbackpack', 'hand_waterbottle', 'bottom_grayshorts'].map((i) => buy('G004', i)))
  const { data: g4 } = await db.from('game_purchases').select('item_key, price').eq('employee_id', E.G004)
  const spent = g4.reduce((s, p) => s + p.price, 0)
  check('다른 아이템 6개 동시 요청 → 쓴 햇빛이 받은 햇빛(70)을 넘지 않음', spent <= 70 && spent > 0, `성공 ${all.filter((x) => x.ok).length}건, ${spent}개 사용`)
  const same = await Promise.all(Array.from({ length: 6 }, () => buy('G005', 'hat_hairband')))
  void same
  // G005는 햇빛 0 → 모두 거부. 햇빛을 준 뒤 같은 아이템 동시 6번
  for (const d of [LAUNCH, add(LAUNCH, 1), add(LAUNCH, 2)]) await addLog(E.G005, d)
  const same2 = await Promise.all(Array.from({ length: 6 }, () => buy('G005', 'hat_hairband')))
  const { count: capRows } = await db.from('game_purchases').select('item_key', { count: 'exact', head: true }).eq('employee_id', E.G005).eq('item_key', 'hat_hairband')
  check('같은 아이템 동시 6번 → 1건만 구매', capRows === 1 && same2.filter((x) => x.ok).length === 1, `성공 ${same2.filter((x) => x.ok).length}`)

  section('P2-3. 장착·해제·새로고침·다른 기기')
  r = await equip('G003', 'back', 'back_greenbackpack')
  check('가진 아이템 장착', r.ok && r.game?.character?.equipped?.back === 'back_greenbackpack')
  r = await equip('G003', 'hat', 'hat_hairband')
  check('안 가진 아이템 장착 거부', r.status === 403)
  r = await equip('G003', 'shoes', 'back_greenbackpack')
  check('부위가 다른 아이템 장착 거부', r.status === 400)
  const { error: fkErr } = await db.from('game_equipment').insert({ employee_id: E.G003, slot: 'hat', item_key: 'hat_hairband' })
  check('DB도 안 가진 아이템 장착을 거부(외래키)', fkErr?.code === '23503', fkErr?.code)
  r = await game('G003')
  check('새로고침 뒤에도 장착 유지', r.character?.equipped?.back === 'back_greenbackpack')
  const other = new Device()
  await other.call('/api/auth/login', { method: 'POST', body: { employeeId: E.G003, pin: PINS.G003 } })
  r = await other.call('/api/me/game')
  check('다른 기기 로그인 뒤에도 같은 장착 상태', r.character?.equipped?.back === 'back_greenbackpack' && r.character?.owned?.includes('back_greenbackpack'))
  r = await equip('G003', 'back', null)
  check('해제', r.ok && r.game?.character?.equipped?.back === null)
  r = await other.call('/api/me/game')
  check('해제도 다른 기기에 반영', r.character?.equipped?.back === null)
  r = await dev.G002.call('/api/me/game/equip', { method: 'PUT', body: { slot: 'back', item: 'back_greenbackpack', employeeId: E.G003 } })
  check('다른 직원의 아이템으로 장착 시도 거부', r.status === 403)

  section('P2-4. 기록 삭제로 햇빛이 줄면')
  await equip('G003', 'back', 'back_greenbackpack')
  await db.from('exercise_logs').delete().eq('employee_id', E.G003).in('log_date', [LAUNCH, add(LAUNCH, 1), add(LAUNCH, 2)])
  r = await game('G003')
  check('산 아이템·장착은 그대로', r.character?.owned?.includes('back_greenbackpack') && r.character?.equipped?.back === 'back_greenbackpack')
  check('잔액은 0으로 보이고 모자란 만큼 표시', r.sunlight?.balance === 0 && r.sunlight?.shortfall > 0, `잔액 ${r.sunlight?.balance}, 모자람 ${r.sunlight?.shortfall}`)
  r = await buy('G003', 'hand_waterbottle')
  check('모자란 동안 새 구매 거부', r.status === 409 && r.code === 'insufficient')

  section('P2-5. 피드 표시 (본인이 켠 직원만, 잔액 비공개)')
  r = await nobody.call(`/api/game/feed?ids=${E.G003},${E.G004}`)
  check('켜지 않은 직원은 피드에 안 나옴', r.ok && Object.keys(r.looks ?? {}).length === 0)
  await dev.G003.call('/api/me/game/profile', { method: 'PUT', body: { showInFeed: true } })
  r = await nobody.call(`/api/game/feed?ids=${E.G003},${E.G004}`)
  check('켠 직원만 나무·장착 아이템 표시', !!r.looks?.[E.G003] && !r.looks?.[E.G004] && r.looks[E.G003].items.includes('초록 배낭'))
  check('피드 응답에 햇빛 잔액·내역 없음', !/balance|earned|ledger|sunlight/.test(JSON.stringify(r)))
  r = await nobody.call('/api/game/feed?ids=abc')
  check('잘못된 ID 형식 거부', r.status === 400)

  section('P2-6. 피드 이름 앞 이모지 (본인이 고름, 목록만)')
  const prof = (k, body) => dev[k].call('/api/me/game/profile', { method: 'PUT', body })
  r = await nobody.call(`/api/game/feed?ids=${E.G003},${E.G004}`)
  check('고르기 전에는 이모지 없음', r.ok && Object.keys(r.emojis ?? {}).length === 0)
  r = await prof('G004', { nameEmoji: '😎' })
  check('표정 이모지 저장', r.ok && r.nameEmoji === '😎')
  r = await prof('G004', { nameEmoji: '🐢' })
  check('목록에 있는 이모지 저장', r.ok && r.nameEmoji === '🐢')
  r = await dev.G004.call('/api/me/game')
  check('새로고침 뒤에도 내 이모지 유지', r.nameEmoji === '🐢')
  check('이모지를 골라도 피드 나무 표시는 꺼진 그대로', r.showInFeed === false)
  r = await nobody.call(`/api/game/feed?ids=${E.G003},${E.G004}`)
  check('피드에 고른 직원만 이모지 표시', r.emojis?.[E.G004] === '🐢' && !r.emojis?.[E.G003])
  check('나무 표시를 안 켠 직원은 나무는 그대로 안 나옴', !r.looks?.[E.G004])
  for (const bad of ['😈', 'abc', '🐢🐢', 123, '<b>']) {
    r = await prof('G004', { nameEmoji: bad })
    check(`목록 밖 값 거부 (${JSON.stringify(bad)})`, r.status === 400)
  }
  r = await dev.G004.call('/api/me/game')
  check('거부된 요청 뒤에도 이모지 그대로', r.nameEmoji === '🐢')
  r = await prof('G003', { nameEmoji: '🔥' })
  r = await dev.G003.call('/api/me/game')
  check('이모지를 바꿔도 이미 켠 나무 표시는 유지', r.showInFeed === true && r.nameEmoji === '🔥')
  r = await prof('G003', { showInFeed: false })
  r = await dev.G003.call('/api/me/game')
  check('나무 표시를 꺼도 이모지는 유지', r.showInFeed === false && r.nameEmoji === '🔥')
  r = await prof('G004', { nameEmoji: null })
  r = await nobody.call(`/api/game/feed?ids=${E.G004}`)
  check('"없음"으로 지우면 피드에서 사라짐', r.ok && !r.emojis?.[E.G004])
  r = await prof('G004', {})
  check('바꿀 내용 없는 요청 거부', r.status === 400)
  r = await nobody.call('/api/me/game/profile', { method: 'PUT', body: { nameEmoji: '🐢' } })
  check('로그인 없이 이모지 변경 거부', r.status === 401)
  r = await dev.G004.call('/api/me/game/profile', { method: 'PUT', body: { nameEmoji: '🐢', employeeId: E.G003 } })
  r = await dev.G003.call('/api/me/game')
  check('다른 직원 ID를 붙여도 본인 것만 바뀜', r.nameEmoji === '🔥')
  const csrf2 = await fetch(base + '/api/me/game/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: [...dev.G004.jar].map(([k, v]) => `${k}=${v}`).join('; ') }, body: '{"nameEmoji":"🐻"}' })
  check('전용 헤더 없는 요청(CSRF) 거부', csrf2.status === 403)
  const { error: anonUpd } = await anon.from('game_profiles').update({ name_emoji: '🐻' }).eq('employee_id', E.G004)
  const { data: after } = await db.from('game_profiles').select('name_emoji').eq('employee_id', E.G004).maybeSingle()
  check('공개 키로 이모지 직접 쓰기 차단', !!anonUpd || after?.name_emoji !== '🐻')
  const { error: lenErr } = await db.from('game_profiles').update({ name_emoji: '가나다라마바사아자차' }).eq('employee_id', E.G004)
  check('DB도 너무 긴 값 거부(길이 제한)', lenErr?.code === '23514', lenErr?.code)

  section('P2-7. 캐릭터 2종 고르기 (029 적용 여부에 따라)')
  const { error: colErr } = await db.from('game_profiles').select('character').limit(1)
  const has029 = !colErr
  r = await dev.G004.call('/api/me/game')
  check('고르기 전에는 캐릭터 없음(화면은 기본 캐릭터)', r.characterKey === null)
  for (const bad of ['x', 'M', '', null, 1]) {
    r = await prof('G004', { character: bad })
    check(`잘못된 캐릭터 거부 (${JSON.stringify(bad)})`, r.status === 400)
  }
  r = await prof('G004', { character: 'f' })
  if (!has029) {
    check('029 전: 캐릭터 저장은 "준비 중"(503)으로 안전하게 거부', r.status === 503, `${r.status}`)
    r = await dev.G004.call('/api/me/game')
    check('029 전: 정원 조회는 정상(기존 칸만 읽음)', r.ok && r.characterKey === null && typeof r.sunlight?.balance === 'number')
  } else {
    check('캐릭터 저장(여성형)', r.ok && r.character === 'f')
    r = await dev.G004.call('/api/me/game'); check('새로고침 뒤에도 유지', r.characterKey === 'f')
    r = await prof('G003', { character: 'm' })
    r = await dev.G003.call('/api/me/game'); check('직원별로 따로 저장', r.characterKey === 'm')
  }
  // 아이템 상점은 화면에서 숨겼지만 구매·장착 자료는 그대로
  const { count: buys } = await db.from('game_purchases').select('item_key', { count: 'exact', head: true }).in('employee_id', [E.G003, E.G004])
  const { count: eqs } = await db.from('game_equipment').select('slot', { count: 'exact', head: true }).in('employee_id', [E.G003, E.G004])
  check('기존 아이템 구매·장착 자료 보존', (buys ?? 0) > 0 && (eqs ?? 0) >= 0, `구매 ${buys} · 장착 ${eqs}`)
  r = await nobody.call(`/api/game/feed?ids=${E.G003},${E.G004}`)
  check('피드: 캐릭터 공개를 끈 직원은 캐릭터 정보 없음', !r.looks?.[E.G003] && !r.looks?.[E.G004])
}

// ═════════ P3. 부서 공동 정원 ═════════
async function p3() {
  const mkDept = async (name) => (await db.from('departments').insert({ name }).select('id').single()).data.id
  const A = await mkDept('시험v22-정원A'), B = await mkDept('시험v22-정원B'), C = await mkDept('시험v22-정원C')
  for (const ym of months) {
    await db.from('department_headcounts').insert({ department_id: A, year_month: ym, headcount: 3, source: '시험' })
    await db.from('department_headcounts').insert({ department_id: C, year_month: ym, headcount: 1, source: '시험' })
  }
  const assign = (emp, dept, start, end = null) => db.from('employee_departments').insert({ employee_id: emp, department_id: dept, start_date: start, end_date: end })
  await assign(E.G001, A, '2026-10-01')
  await assign(E.G002, A, '2026-10-01')
  await assign(E.G007, A, '2026-10-01', MON) // 이번 주 월요일에 B로 이동
  await assign(E.G007, B, MON)
  await assign(E.G005, C, '2026-10-01')
  await assign(E.G006, C, '2026-10-01')
  // P1·P2에서 남은 기록 정리(정원 계산을 깔끔하게)
  await db.from('exercise_logs').delete().in('employee_id', [E.G001, E.G002, E.G005, E.G006, E.G007])

  section('P3-1. 하루 1번 기여 · 공동 목표')
  const garden = (k) => dev[k].call('/api/me/garden')
  let r = await garden('G001')
  check('내 부서 정원 = A, 이번 주 목표 = 인원 3 × 1일 = 3', r.ok && r.department?.name === '시험v22-정원A' && r.week?.goal === 3, `${r.department?.name} 목표 ${r.week?.goal}`)
  await addLog(E.G001, TODAY); await addLog(E.G001, TODAY); await addLog(E.G001, TODAY)
  r = await garden('G001')
  check('한 직원이 하루 3건 → 기여 1', r.week?.contributions === 1 && r.week?.participants === 1, `${r.week?.contributions}`)
  const g2log = await addLog(E.G002, TODAY)
  r = await garden('G002')
  check('두 번째 직원 → 기여 2, 참여 2명, 아직 미달성', r.week?.contributions === 2 && r.week?.participants === 2 && !r.week?.achieved && r.decorations?.length === 0)
  const prev = TODAY > MON ? add(TODAY, -1) : TODAY
  const extra = await addLog(E.G001, prev === TODAY ? TODAY : prev)
  r = await garden('G001')
  if (prev === TODAY) {
    check('(오늘이 월요일이라 같은 날 추가) 기여 그대로 2', r.week?.contributions === 2)
    await addLog(E.G007, add(LAUNCH, 1)) // 지난주 A 소속일 때
  } else {
    check('목표 3 달성 → 장식 1개 해금', r.week?.achieved && r.decorations?.length === 1, `기여 ${r.week?.contributions}, 장식 ${r.decorations?.length}`)
  }
  await Promise.all(Array.from({ length: 6 }, () => garden('G001')))
  const { count: unl } = await db.from('garden_unlocks').select('week_start', { count: 'exact', head: true }).eq('department_id', A)
  check('동시 조회 6번에도 같은 주 해금 1번', prev === TODAY || unl === 1, `${unl}`)
  const { error: dupErr } = await db.from('garden_unlocks').insert({ department_id: A, week_start: MON, goal: 3 })
  check('DB가 같은 부서·같은 주 해금 두 번 넣기 거부', prev === TODAY || dupErr?.code === '23505', dupErr?.code)
  check('정원 응답에 다른 직원 이름 없음', !/v22시험/.test(JSON.stringify(r)))

  section('P3-2. 기록 삭제 → 해금 재계산')
  if (prev !== TODAY) {
    await db.from('exercise_logs').delete().eq('id', extra)
    r = await garden('G001')
    check('기록 삭제로 목표 미달 → 이번 주 해금 회수', !r.week?.achieved && r.decorations?.length === 0)
    await addLog(E.G001, prev)
    r = await garden('G001')
    check('다시 달성 → 해금 1개(중복 없음)', r.decorations?.length === 1)
  }
  void g2log

  section('P3-3. 부서 이동 (그날 부서 이력 기준)')
  await addLog(E.G007, add(LAUNCH, 2)) // 지난주: A 소속
  await addLog(E.G007, TODAY)          // 이번 주: B 소속
  r = await dev.G007.call('/api/me/garden')
  check('이동한 직원의 정원은 지금 부서(B)', r.department?.name === '시험v22-정원B')
  check('이번 주 기록은 B에 기여', r.week?.contributions === 1 && r.week?.participants === 1)
  r = await garden('G001')
  const aNow = r.week?.contributions
  check('이번 주 A 기여에 이동한 직원 기록 없음', aNow === (prev === TODAY ? 2 : 3), `${aNow}`)

  section('P3-4. 인원 정보 없음·불일치 → 목표 없음 + 관리자 안내')
  r = await dev.G007.call('/api/me/garden')
  check('인원 정보 없는 부서(B): 목표 없음', r.week?.goal === null && r.week?.status === 'no_headcount')
  await addLog(E.G005, TODAY); await addLog(E.G006, TODAY)
  r = await dev.G005.call('/api/me/garden')
  check('참여 2명 > 인사팀 1명(C): 목표 없음(불일치)', r.week?.goal === null && r.week?.status === 'check_needed')
  r = await admin.call('/api/admin/garden')
  const nB = r.notices?.find((n) => n.departmentId === B), nC = r.notices?.find((n) => n.departmentId === C), nA = r.notices?.find((n) => n.departmentId === A)
  check('관리자 안내: B 인원 정보 없음, C 불일치, A는 안내 없음', nB?.status === 'no_headcount' && nC?.status === 'check_needed' && !nA)
  r = await dev.G001.call('/api/admin/garden')
  check('직원은 관리자 안내 조회 불가', r.status === 401)
  r = await nobody.call('/api/me/garden')
  check('로그인 없이 정원 조회 거부', r.status === 401)

  section('P3-5. 퇴사')
  await db.from('employees').update({ left_at: add(TODAY, -1) }).eq('id', E.G002)
  r = await dev.G002.call('/api/me/garden')
  check('퇴사 처리된 직원 세션은 정원 조회 거부', r.status === 401)
  r = await garden('G001')
  check('퇴사 전 기여는 그대로 남음(기여 수 유지)', r.week?.contributions === aNow, `${r.week?.contributions}`)

  section('P3-6. 지난주 해금 · 인원 기준 달(그 주 월요일이 속한 달)')
  {
    const D = await mkDept('시험v22-정원D')
    // 지난주 월요일이 속한 달에만 인원 2명 입력 → 지난주 목표 2일
    await db.from('department_headcounts').insert({ department_id: D, year_month: LAUNCH.slice(0, 7), headcount: 2, source: '시험' })
    await assign(E.G004, D, '2026-10-01')
    await assign(E.G003, D, '2026-10-01')
    await db.from('exercise_logs').delete().in('employee_id', [E.G003, E.G004])
    await addLog(E.G004, LAUNCH); await addLog(E.G003, add(LAUNCH, 6))
    r = await dev.G004.call('/api/me/garden')
    check('지난주(월요일 달 인원 2명) 목표 달성 → 장식 1개, 주 중간 달이 바뀌어도 유지', r.decorations?.length === 1 && r.decorations[0].week === LAUNCH, `${r.decorations?.length} ${LAUNCH}~${add(LAUNCH, 6)}`)
    const sameMonth = MON.slice(0, 7) === LAUNCH.slice(0, 7)
    check('이번 주 목표는 이번 주 월요일 달 인원 기준', sameMonth ? r.week?.goal === 2 : r.week?.goal === null && r.week?.status === 'no_headcount', `${r.week?.goal}`)
    await db.from('employee_departments').delete().in('employee_id', [E.G003, E.G004])
  }

  section('P3-7. 부서 없는 직원')
  r = await dev.G004.call('/api/me/garden')
  check('부서 없는 직원은 "부서 없음" 안내(오류 아님)', r.ok && r.department === null)
}

async function main() {
  await cleanup()
  await db.from('rate_limits').delete().neq('bucket', '')
  originalLaunch = (await db.from('game_settings').select('launch_date').eq('id', 1).single()).data.launch_date
  await db.from('game_settings').update({ launch_date: LAUNCH }).eq('id', 1)
  typeId = (await db.from('exercise_types').select('id').limit(1).single()).data.id
  await makeEmployees()
  if (only === 'all' || only === 'p1') await p1()
  if (only === 'all' || only === 'p2') await p2()
  if (only === 'all' || only === 'p3') await p3()
}

try {
  await main()
} catch (e) {
  check('시험 실행 중 오류 없음', false, e.message)
} finally {
  await cleanup()
  if (originalLaunch) await db.from('game_settings').update({ launch_date: originalLaunch }).eq('id', 1)
  const { data: s } = await db.from('game_settings').select('launch_date').eq('id', 1).single()
  const { count } = await db.from('employees').select('id', { count: 'exact', head: true }).like('employee_number', 'G%')
  console.log(`\n정리: 시험 직원·부서 삭제 (남은 G 직원 ${count}명), 도입일 원래대로 ${s.launch_date}`)
  console.log(`결과: ${pass}/${total} 통과${fails.length ? `\n실패: ${fails.join(' / ')}` : ''}`)
  process.exit(pass === total ? 0 : 2)
}
