// v2.1 참여 기능 자동 시험 — ⚠️ 시험 DB에 연결된 로컬 서버에서만 (운영 주소면 실행 거부)
//
// 사용법: node scripts/v21-test.mjs http://localhost:3576 .env.local
//
// 사번 V로 시작하는 시험 직원 4명, '시험v21-' 부서·챌린지를 만들고 끝나면 모두 지웁니다.
// (다른 시험이 쓰는 C·T 사번은 건드리지 않음)
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './backup.mjs'

const [base, envFile] = process.argv.slice(2)
if (!base?.startsWith('http://localhost') || !envFile) {
  console.error('사용법: node scripts/v21-test.mjs http://localhost:<포트> <시험 env 파일>')
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
const YM = TODAY.slice(0, 7)

async function cleanup() {
  const { data: old } = await db.from('employees').select('id').like('employee_number', 'V%')
  if (old?.length) await db.from('employees').delete().in('id', old.map((e) => e.id))
  const { data: ch } = await db.from('challenges').select('id').like('title', '시험v21-%')
  if (ch?.length) await db.from('challenges').delete().in('id', ch.map((c) => c.id))
  const { data: dp } = await db.from('departments').select('id').like('name', '시험v21-%')
  if (dp?.length) {
    await db.from('employee_departments').delete().in('department_id', dp.map((d) => d.id))
    await db.from('departments').delete().in('id', dp.map((d) => d.id))
  }
}

let typeId
async function addLog(empId, date, seconds, extra = {}) {
  const { data, error } = await db
    .from('exercise_logs')
    .insert({ employee_id: empId, exercise_type_id: typeId, log_date: date, duration_seconds: seconds, memo: '시험v21', ...extra })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function main() {
  await cleanup()
  await db.from('rate_limits').delete().neq('bucket', '')
  typeId = (await db.from('exercise_types').select('id').limit(1).single()).data.id

  // 시험 직원 V001~V004 (10월 1일 등록)
  const { data: emps, error: empErr } = await db
    .from('employees')
    .insert(['V001', 'V002', 'V003', 'V004'].map((n, i) => ({ name: `v21시험${i + 1}`, employee_number: n, created_at: '2026-10-01T00:00:00+09:00' })))
    .select('id, employee_number')
  if (empErr) throw new Error(empErr.message)
  const E = Object.fromEntries(emps.map((e) => [e.employee_number, e.id]))

  // 관리자 로그인 + PIN 발급 + 직원 로그인
  const admin = new Device()
  await admin.call('/api/verify-admin', { method: 'POST', body: { password: env.ADMIN_PASSWORD } })
  const dev = {}
  const PINS = { V001: '583921', V002: '692047', V003: '470385', V004: '815263' }
  for (const k of Object.keys(PINS)) {
    const r = await admin.call('/api/admin/pins', { method: 'POST', body: { mode: 'reset', employeeId: E[k] } })
    const temp = r.issued?.[0]?.pin
    dev[k] = new Device()
    await dev[k].call('/api/auth/login', { method: 'POST', body: { employeeId: E[k], pin: temp } })
    const c = await dev[k].call('/api/auth/change-pin', { method: 'POST', body: { currentPin: temp, newPin: PINS[k] } })
    if (!c.ok) throw new Error(`${k} PIN 변경 실패: ${c.message}`)
  }
  const nobody = new Device()
  const eng = async (k) => dev[k].call('/api/me/engagement')

  section('1. 개인 목표 (생성·수정·달성률)')
  let r = await eng('V001')
  check('목표 없을 때 goal = null', r.ok && r.goal === null)
  check('주 시작이 한국 시간 월요일', r.week?.start === MON, `${r.week?.start} = ${MON}`)
  r = await dev.V001.call('/api/me/goal', { method: 'PUT', body: { kind: 'sessions', target: 3 } })
  check('목표 생성 (주 3회)', r.ok && r.goal?.target === 3 && r.goal?.effective_from === MON)
  // 이번 주 기록: 오늘 200분 + 200분(같은 날 → 300분 상한) + 시간 없는 과거 기록 1건
  const l1 = await addLog(E.V001, TODAY, 200 * 60)
  const l2 = await addLog(E.V001, TODAY, 200 * 60)
  const l3 = await addLog(E.V001, MON, null, { duration_minutes: null })
  r = await eng('V001')
  check('달성률: 횟수 3/3 (시간 없는 기록도 횟수에 포함)', r.goal?.value === 3 && r.goal?.target === 3, `${r.goal?.value}/${r.goal?.target}`)
  check('하루 300분 상한 (400분 → 300분)', r.week?.minutes === 300, `${r.week?.minutes}분`)
  check('시간 없는 과거 기록은 활동일로 인정, 시간 0분', r.week?.activeDays === (MON === TODAY ? 1 : 2))
  r = await dev.V001.call('/api/me/goal', { method: 'PUT', body: { kind: 'minutes', target: 150 } })
  check('목표 수정 (주 150분, 같은 주는 덮어씀)', r.ok && r.goal?.kind === 'minutes')
  const { count: goalRows } = await db.from('personal_goals').select('id', { count: 'exact', head: true }).eq('employee_id', E.V001)
  check('같은 주 목표는 1줄', goalRows === 1)
  r = await eng('V001')
  check('시간 목표 달성률 300/150', r.goal?.value === 300 && r.goal?.target === 150)
  for (const [body, label] of [[{ kind: 'sessions', target: 0 }, '0회'], [{ kind: 'minutes', target: 5 }, '5분'], [{ kind: 'steps', target: 3 }, '없는 종류'], [{ kind: 'sessions', target: 2.5 }, '소수']]) {
    r = await dev.V001.call('/api/me/goal', { method: 'PUT', body })
    check(`잘못된 목표 거부 (${label})`, r.status === 400)
  }
  // 지난주 일요일 기록은 이번 주에 안 들어감 (주 경계)
  await addLog(E.V001, add(MON, -1), 60 * 60)
  r = await eng('V001')
  check('주 경계: 지난 일요일 기록은 이번 주 제외', r.week?.sessions === 3, `이번 주 ${r.week?.sessions}회`)

  section('2. 개인정보 (본인만)')
  r = await nobody.call('/api/me/engagement')
  check('로그인 없이 내 현황 조회 거부', r.status === 401)
  r = await nobody.call('/api/me/goal', { method: 'PUT', body: { kind: 'sessions', target: 2 } })
  check('로그인 없이 목표 변경 거부', r.status === 401)
  r = await dev.V002.call('/api/me/goal', { method: 'PUT', body: { kind: 'sessions', target: 9, employeeId: E.V001 } })
  const { data: v1goal } = await db.from('personal_goals').select('kind, target').eq('employee_id', E.V001).single()
  check('다른 직원 ID를 보내도 본인(V002) 목표만 바뀜', r.ok && v1goal.kind === 'minutes' && v1goal.target === 150)
  r = await eng('V002')
  check('V002 현황에 V001 기록 없음', r.total?.sessions === 0 && r.goal?.target === 9)
  for (const t of ['personal_goals', 'employee_badges', 'challenge_participants', 'challenges', 'departments', 'employee_departments', 'department_headcounts']) {
    const { data, error } = await anon.from(t).select('*').limit(1)
    check(`공개 키로 ${t} 읽기 차단`, !!error || (data ?? []).length === 0, error?.code ?? '')
  }
  {
    const { error: e1 } = await anon.from('employees').select('left_at').limit(1)
    check('공개 키로 employees.left_at 읽기 차단', e1?.code === '42501', e1?.code)
    const { error: e2 } = await anon.from('employees').select('*').limit(1)
    check('공개 키로 employees 전체(*) 읽기 차단', e2?.code === '42501', e2?.code)
    const { data: d3, error: e3 } = await anon.from('employees').select('id, name, employee_number, color, created_at').limit(1)
    check('공개 키로 화면용 칸(이름 등)은 읽기 가능', !e3 && d3?.length === 1)
    const { error: e4 } = await anon.from('exercise_logs').select('id, employee:employees(left_at)').limit(1)
    check('기록 조회에 끼워 넣어도 left_at 읽기 차단', !!e4, e4?.code)
    const pub = await nobody.call('/api/employees')
    check('이름 목록 API에 퇴사일 칸 없음', pub.ok && !JSON.stringify(pub).includes('left_at'))
  }
  const { error: insErr } = await anon.from('personal_goals').insert({ employee_id: E.V001, kind: 'sessions', target: 1, effective_from: MON })
  check('공개 키로 목표 직접 쓰기 차단', !!insErr)

  section('3. 기록 수정·삭제 시 재계산')
  r = await dev.V001.call(`/api/logs/${l1}`, { method: 'PATCH', body: { exerciseTypeId: typeId, logDate: TODAY, durationSeconds: 30 * 60, distanceKm: null, memo: '시험v21' } })
  r = await eng('V001')
  check('기록 수정 → 인정 시간 재계산 (200+30=230분)', r.week?.minutes === 230, `${r.week?.minutes}분`)
  r = await dev.V001.call(`/api/logs/${l2}`, { method: 'DELETE' })
  r = await eng('V001')
  check('기록 삭제 → 횟수·시간 재계산 (2회, 30분)', r.week?.sessions === 2 && r.week?.minutes === 30, `${r.week?.sessions}회 ${r.week?.minutes}분`)
  check('목표 달성률도 재계산 (30/150)', r.goal?.value === 30)

  section('4. 배지 (자동 지급·중복 방지·회수)')
  check('첫 기록 배지 자동 지급', r.badges?.earned?.some((b) => b.key === 'sessions_1'))
  // 3일 연속 → streak_3
  const s1 = await addLog(E.V003, add(TODAY, -12), 1800)
  const s2 = await addLog(E.V003, add(TODAY, -11), 1800)
  const s3 = await addLog(E.V003, add(TODAY, -10), 1800)
  const v3 = new Device(); await v3.call('/api/auth/login', { method: 'POST', body: { employeeId: E.V003, pin: PINS.V003 } })
  r = await v3.call('/api/me/engagement')
  check('3일 연속 배지 지급', r.badges?.earned?.some((b) => b.key === 'streak_3'))
  const nextStreak = r.badges?.next?.find((n) => n.series === 'streak')
  check('다음 배지 조건 표시 (연속 7일)', nextStreak?.next?.threshold === 7 && nextStreak?.current === 3)
  await Promise.all(Array.from({ length: 8 }, () => v3.call('/api/me/engagement')))
  const { data: bRows } = await db.from('employee_badges').select('badge_key').eq('employee_id', E.V003)
  const keys = bRows.map((b) => b.badge_key)
  check('동시 조회 8번에도 배지 중복 없음', keys.length === new Set(keys).size && keys.filter((k) => k === 'streak_3').length === 1, keys.join(','))
  const { error: dupErr } = await db.from('employee_badges').insert({ employee_id: E.V003, badge_key: 'streak_3' })
  check('DB가 같은 배지 두 번 넣기 거부', dupErr?.code === '23505')
  await db.from('exercise_logs').delete().eq('id', s2)
  r = await v3.call('/api/me/engagement')
  check('기록 삭제로 연속이 끊기면 배지 회수', !r.badges?.earned?.some((b) => b.key === 'streak_3'))
  void s1; void s3

  section('5. 챌린지 (참여·진행·종료)')
  const mk = (title, metric, target, startDate, endDate) => admin.call('/api/admin/challenges', { method: 'POST', body: { title, description: '시험', metric, target, startDate, endDate } })
  r = await dev.V001.call('/api/admin/challenges', { method: 'POST', body: { title: '시험v21-불가', metric: 'sessions', target: 1, startDate: TODAY, endDate: TODAY } })
  check('직원은 챌린지 생성 불가', r.status === 401)
  const C1 = (await mk('시험v21-진행', 'sessions', 3, add(TODAY, -2), add(TODAY, 5))).challenge
  const C2 = (await mk('시험v21-예정', 'minutes', 60, add(TODAY, 3), add(TODAY, 9))).challenge
  const C3 = (await mk('시험v21-종료', 'active_days', 2, add(TODAY, -10), add(TODAY, -1))).challenge
  check('관리자 챌린지 생성 3개', !!C1?.id && !!C2?.id && !!C3?.id)
  r = await mk('시험v21-잘못', 'sessions', 1, TODAY, add(TODAY, -1))
  check('종료일이 시작일보다 앞서면 거부', r.status === 400)
  // V002: 시작 전 기록 1건, 기간 안 기록 2건(참여 전 작성) → 늦게 참여해도 기간 안 기록 인정
  await addLog(E.V002, add(TODAY, -3), 1800)
  await addLog(E.V002, add(TODAY, -2), 1800) // 시작일 당일
  await addLog(E.V002, add(TODAY, -1), 1800)
  await Promise.all(Array.from({ length: 5 }, () => dev.V002.call(`/api/challenges/${C1.id}/join`, { method: 'POST' })))
  const { count: joinRows } = await db.from('challenge_participants').select('employee_id', { count: 'exact', head: true }).eq('challenge_id', C1.id).eq('employee_id', E.V002)
  check('참여 버튼 5번 동시 → 1명', joinRows === 1)
  r = await eng('V002')
  let c1 = r.challenges?.find((c) => c.id === C1.id)
  check('시작 전 기록 제외, 시작일·참여 전 기간 기록 인정 (2/3)', c1?.joined && c1?.progress === 2 && c1?.status === 'active', `진행 ${c1?.progress}`)
  await addLog(E.V002, TODAY, 600)
  r = await eng('V002')
  c1 = r.challenges?.find((c) => c.id === C1.id)
  check('기록 추가 → 목표 달성 (3/3)', c1?.progress === 3)
  r = await dev.V002.call(`/api/challenges/${C3.id}/join`, { method: 'POST' })
  check('끝난 챌린지 참여 거부', r.status === 400)
  r = await dev.V002.call(`/api/challenges/${C2.id}/join`, { method: 'POST' })
  check('예정 챌린지 미리 참여 가능', r.ok)
  r = await eng('V002')
  check('예정 챌린지 진행률 0, 상태 upcoming', r.challenges?.find((c) => c.id === C2.id)?.progress === 0 && r.challenges?.find((c) => c.id === C2.id)?.status === 'upcoming')
  // 종료 챌린지 경계: 마지막 날 기록 인정, 다음 날(오늘) 기록 제외 (참여 기록은 DB로 직접 넣어 계산만 확인)
  await db.from('challenge_participants').insert({ challenge_id: C3.id, employee_id: E.V004 })
  await addLog(E.V004, add(TODAY, -10), 600) // 첫날
  await addLog(E.V004, add(TODAY, -1), 600) // 마지막 날
  await addLog(E.V004, TODAY, 600) // 끝난 뒤
  await addLog(E.V004, add(TODAY, -11), 600) // 시작 전
  const v4 = new Device(); await v4.call('/api/auth/login', { method: 'POST', body: { employeeId: E.V004, pin: PINS.V004 } })
  r = await v4.call('/api/me/engagement')
  const c3 = r.challenges?.find((c) => c.id === C3.id)
  check('챌린지 첫날·마지막 날 포함, 시작 전·종료 뒤 제외 (활동일 2)', c3?.progress === 2 && c3?.status === 'ended', `진행 ${c3?.progress}`)
  r = await admin.call(`/api/admin/challenges/${C1.id}`, { method: 'PATCH', body: { title: '시험v21-진행', description: '', metric: 'minutes', target: 3, startDate: C1.start_date, endDate: C1.end_date } })
  check('참여자 있는 챌린지 기준 변경 거부', r.status === 400)
  r = await admin.call(`/api/admin/challenges/${C1.id}`, { method: 'PATCH', body: { endNow: true } })
  check('관리자 챌린지 종료', r.ok && r.challenge?.end_date === add(TODAY, -1))
  r = await admin.call('/api/admin/challenges')
  const a1 = r.challenges?.find((c) => c.id === C1.id)
  check('종료 챌린지 참여·달성 인원 집계 (기간 안 기록 기준)', a1?.status === 'ended' && a1?.participants === 1 && a1?.achieved === 0, `참여 ${a1?.participants} 달성 ${a1?.achieved}(오늘 기록은 종료 뒤라 제외)`)
  r = await nobody.call('/api/challenges')
  check('공개 챌린지 목록: 참여 인원만, 이름 없음', r.ok && !JSON.stringify(r).includes('v21시험') && r.challenges?.some((c) => c.id === C1.id))

  section('6. 부서별 순위·참여율')
  r = await dev.V001.call('/api/admin/departments', { method: 'POST', body: { name: '시험v21-불가' } })
  check('직원은 부서 생성 불가', r.status === 401)
  const DA = (await admin.call('/api/admin/departments', { method: 'POST', body: { name: '시험v21-A' } })).department
  const DB = (await admin.call('/api/admin/departments', { method: 'POST', body: { name: '시험v21-B' } })).department
  check('부서 생성', !!DA?.id && !!DB?.id)
  for (const [k, d] of [['V001', DA], ['V002', DA], ['V003', DB]]) {
    r = await admin.call(`/api/admin/employees/${E[k]}/department`, { method: 'POST', body: { departmentId: d.id, startDate: '2026-10-01' } })
  }
  check('부서 배정', r.ok)
  // B 부서: 횟수는 적고 시간은 많게 (순위가 기준별로 달라지는지)
  await addLog(E.V003, TODAY, 280 * 60)
  r = await nobody.call('/api/departments/ranking?period=week')
  const rowA = r.departments?.find((d) => d.id === DA.id)
  const rowB = r.departments?.find((d) => d.id === DB.id)
  check('부서별 참여 인원 (A 2명, B 1명)', rowA?.participants === 2 && rowB?.participants === 1, `A ${rowA?.participants} · B ${rowB?.participants}`)
  check('인사팀 인원 없으면 참여율 null (인원 정보 없음)', rowA?.rate === null && rowA?.headcount === null)
  const posS = (id) => r.bySessions.indexOf(id), posM = (id) => r.byMinutes.indexOf(id)
  check('운동 횟수 순위와 인정 시간 순위를 따로 계산 (A가 횟수 앞, B가 시간 앞)', posS(DA.id) < posS(DB.id) && posM(DB.id) < posM(DA.id), `A ${rowA?.sessions}회 ${rowA?.minutes}분 · B ${rowB?.sessions}회 ${rowB?.minutes}분`)
  check('부서 미배정 직원은 따로 집계 (V004)', r.unassigned?.participants >= 1)
  check('순위 응답에 직원 이름 없음', !JSON.stringify(r).includes('v21시험'))
  r = await dev.V001.call(`/api/admin/departments/${DA.id}/headcount`, { method: 'PUT', body: { yearMonth: YM, headcount: 4, source: '시험' } })
  check('직원은 인원 입력 불가', r.status === 401)
  r = await admin.call(`/api/admin/departments/${DA.id}/headcount`, { method: 'PUT', body: { yearMonth: YM, headcount: 4 } })
  check('자료 출처 없이 인원 입력 거부', r.status === 400)
  const hcPut = await admin.call(`/api/admin/departments/${DA.id}/headcount`, { method: 'PUT', body: { yearMonth: YM, headcount: 4, source: '시험 인사팀 자료' } })
  r = await nobody.call('/api/departments/ranking?period=week')
  check('인사팀 인원 입력 → 참여율 = 참여 2 / 인원 4', r.departments?.find((d) => d.id === DA.id)?.rate === 0.5 && r.departments?.find((d) => d.id === DB.id)?.rate === null, `입력 ${hcPut.status} ${hcPut.message ?? ''} · A ${JSON.stringify(r.departments?.find((d) => d.id === DA.id))}`)
  // 참여 인원 > 인사팀 인원이면 100%로 자르지 않고 '인원 확인 필요' + 관리자 경고, 원래 값 보존
  await admin.call(`/api/admin/departments/${DA.id}/headcount`, { method: 'PUT', body: { yearMonth: YM, headcount: 1, source: '시험 불일치' } })
  r = await nobody.call('/api/departments/ranking?period=week')
  const mm = r.departments?.find((d) => d.id === DA.id)
  check('참여 2 > 인사팀 1 → 100%로 자르지 않고 인원 확인 필요(rate null)', mm?.rateStatus === 'check_needed' && mm?.rate === null && mm?.participants === 2 && mm?.headcount === 1, JSON.stringify(mm))
  const ad = await admin.call('/api/admin/departments')
  check('관리자 부서 화면에 불일치 경고', ad.mismatches?.some((x) => x.id === DA.id && x.participants === 2 && x.headcount === 1))
  const { data: hcRow } = await db.from('department_headcounts').select('headcount').eq('department_id', DA.id).eq('year_month', YM).single()
  check('인사팀 입력값은 바뀌지 않고 보존', hcRow.headcount === 1)
  await admin.call(`/api/admin/departments/${DA.id}/headcount`, { method: 'PUT', body: { yearMonth: YM, headcount: 4, source: '시험 인사팀 자료' } })
  r = await nobody.call('/api/departments/ranking?period=week')
  check('인원 바로잡으면 다시 참여율 표시', r.departments?.find((d) => d.id === DA.id)?.rateStatus === 'ok')
  // 부서 이동: V002 를 오늘부터 B로 → 오늘 기록은 B, 이전 기록은 A
  r = await admin.call(`/api/admin/employees/${E.V002}/department`, { method: 'POST', body: { departmentId: DB.id, startDate: TODAY } })
  const { data: hist } = await db.from('employee_departments').select('department_id, start_date, end_date').eq('employee_id', E.V002).order('start_date')
  check('부서 이동 시 과거 이력 보존 (A 끝날짜 = 오늘, B 시작)', hist.length === 2 && hist[0].end_date === TODAY && hist[1].department_id === DB.id)
  r = await nobody.call('/api/departments/ranking?period=month')
  const mA = r.departments?.find((d) => d.id === DA.id), mB = r.departments?.find((d) => d.id === DB.id)
  const { data: v2logs } = await db.from('exercise_logs').select('log_date').eq('employee_id', E.V002)
  check('이동 전 기록은 A, 이동일 기록은 B로 집계', mA?.participants === 2 && mB?.participants === 2, `A ${mA?.participants} · B ${mB?.participants} · 이동 ${r.from}~${r.to} · V002 기록일 ${v2logs.map((x) => x.log_date).join(',')} · 이력 ${JSON.stringify(hist)}`)

  section('7. 퇴사 처리 (기록·이력 보존)')
  const before = (await db.from('exercise_logs').select('id', { count: 'exact', head: true }).eq('employee_id', E.V003)).count
  r = await dev.V001.call(`/api/admin/employees/${E.V003}/retire`, { method: 'POST', body: { leftAt: add(TODAY, -1) } })
  check('직원은 퇴사 처리 불가', r.status === 401)
  r = await admin.call(`/api/admin/employees/${E.V003}/retire`, { method: 'POST', body: { leftAt: add(TODAY, -1) } })
  check('관리자 퇴사 처리', r.ok && r.employee?.left_at === add(TODAY, -1))
  r = await v3.call('/api/me/engagement')
  check('퇴사 처리 즉시 로그인 중인 기기 로그아웃', r.status === 401)
  r = await new Device().call('/api/auth/login', { method: 'POST', body: { employeeId: E.V003, pin: PINS.V003 } })
  check('퇴사자 로그인 거부', r.status === 403)
  const after = (await db.from('exercise_logs').select('id', { count: 'exact', head: true }).eq('employee_id', E.V003)).count
  check('퇴사자 운동 기록 보존', before === after && after > 0, `${after}건`)
  const { data: h3 } = await db.from('employee_departments').select('end_date').eq('employee_id', E.V003)
  check('퇴사자 부서 이력 보존 (끝날짜 = 퇴사 다음 날)', h3.length === 1 && h3[0].end_date === TODAY)
  r = await nobody.call('/api/employees')
  check('퇴사자는 본인 확인 이름 목록에서 빠짐', r.ok && !r.employees.some((e) => e.id === E.V003) && r.employees.some((e) => e.id === E.V001))
  const { data: anonHc, error: anonHcErr } = await anon.rpc('calendar_headcount', { p_day: TODAY })
  check('공개 키로 달력 분모 함수는 그대로 동작(퇴사일은 안 나감)', !anonHcErr && typeof anonHc?.count === 'number' && !JSON.stringify(anonHc).includes('left'))
  const { data: hcToday } = await db.rpc('calendar_headcount', { p_day: TODAY })
  const { data: hcYest } = await db.rpc('calendar_headcount', { p_day: add(TODAY, -1) })
  check('달력 분모: 퇴사일까지 포함, 다음 날부터 제외', hcYest.count - hcToday.count >= 1, `어제 ${hcYest.count} → 오늘 ${hcToday.count}`)

  section('8. 관리자 권한')
  for (const [m, p, b] of [
    ['GET', '/api/admin/departments'],
    ['GET', '/api/admin/challenges'],
    ['POST', `/api/admin/employees/${E.V001}/department`, { departmentId: null }],
    ['PATCH', `/api/admin/departments/${DA.id}`, { name: 'x' }],
    ['PATCH', `/api/admin/challenges/${C2.id}`, { endNow: true }],
  ]) {
    r = await dev.V001.call(p, { method: m, body: b })
    check(`직원 세션으로 ${m} ${p.replace(/[0-9a-f-]{36}/g, ':id')} 거부`, r.status === 401)
  }
  r = await new Device().call('/api/admin/departments', { method: 'POST', body: { name: '시험v21-x' } })
  check('CSRF 헤더 있어도 관리자 세션 없으면 거부', r.status === 401)

  section('9. 오늘 퇴사 처리 → 다음 날부터 세션 차단')
  r = await admin.call(`/api/admin/employees/${E.V004}/retire`, { method: 'POST', body: { leftAt: TODAY } })
  const v4b = new Device()
  r = await v4b.call('/api/auth/login', { method: 'POST', body: { employeeId: E.V004, pin: PINS.V004 } })
  check('퇴사일(마지막 근무일) 당일에는 로그인 가능', r.ok === true)
  r = await v4b.call('/api/me/engagement')
  check('당일 세션으로 내 현황 조회 가능', r.ok === true)
  // 다음 날이 된 것처럼: 퇴사일을 어제로 바꿈 → 이미 받은 세션도 막혀야 함
  await db.from('employees').update({ left_at: add(TODAY, -1) }).eq('id', E.V004)
  r = await v4b.call('/api/me/engagement')
  check('퇴사일이 지나면 이미 받은 세션으로 현황 조회 거부', r.status === 401)
  r = await v4b.call('/api/logs', { method: 'POST', body: { requestId: 'rid-retired-0001', exerciseTypeId: typeId, logDate: TODAY, durationSeconds: 600, distanceKm: null, memo: null } })
  check('퇴사일이 지나면 기록 작성 거부', r.status === 401)
  r = await v4b.call('/api/auth/me')
  check('퇴사일이 지나면 로그인 상태도 없음으로 표시', r.ok && r.me === null)

  section('10. 참여 행 1,000건 초과 집계')
  const allEmp = []
  for (let off = 0; ; off += 1000) {
    const { data } = await db.from('employees').select('id').order('id').range(off, off + 999)
    allEmp.push(...data)
    if (data.length < 1000) break
  }
  const per = Math.min(300, allEmp.length)
  const bigIds = []
  for (let i = 0; i < 4; i++) bigIds.push((await mk(`시험v21-대량${i}`, 'sessions', 1, TODAY, add(TODAY, 3))).challenge.id)
  const rows = bigIds.flatMap((cid) => allEmp.slice(0, per).map((e) => ({ challenge_id: cid, employee_id: e.id })))
  for (let i = 0; i < rows.length; i += 500) await db.from('challenge_participants').insert(rows.slice(i, i + 500))
  r = await nobody.call('/api/challenges')
  const pubCounts = bigIds.map((id) => r.challenges.find((c) => c.id === id)?.participants)
  check(`공개 목록 참여 인원: 챌린지 4개 × ${per}명 = ${rows.length}행에서도 잘리지 않음`, rows.length > 1000 && pubCounts.every((n) => n === per), pubCounts.join(','))
  r = await admin.call('/api/admin/challenges')
  const admCounts = bigIds.map((id) => r.challenges.find((c) => c.id === id)?.participants)
  check('관리자 현황 참여 인원도 잘리지 않음', admCounts.every((n) => n === per), admCounts.join(','))
  r = await eng('V001')
  const myCounts = bigIds.map((id) => r.challenges?.find((c) => c.id === id)?.participants)
  check('내 현황의 참여 인원도 잘리지 않음', myCounts.every((n) => n === per), myCounts.join(','))
}

try {
  await main()
} catch (e) {
  check('시험 실행 중 오류 없음', false, e.message)
} finally {
  await cleanup()
  const { count } = await db.from('employees').select('id', { count: 'exact', head: true }).like('employee_number', 'V%')
  console.log(`\n정리: 시험 직원·부서·챌린지 삭제 (남은 V 직원 ${count}명)`)
  console.log(`결과: ${pass}/${total} 통과${fails.length ? `\n실패: ${fails.join(' / ')}` : ''}`)
  process.exit(pass === total ? 0 : 2)
}
