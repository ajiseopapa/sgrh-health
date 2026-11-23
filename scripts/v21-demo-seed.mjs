// 화면 캡처용 시험 데이터 — ⚠️ 시험 DB 전용 (운영 주소면 거부)
// 사용법: node scripts/v21-demo-seed.mjs http://localhost:3576 .env.local [--clean]
// 사번 S로 시작하는 가상 직원 6명, '간호부·원무팀·재활치료팀' 가상 부서, 챌린지 2개를 만듭니다. --clean 이면 지우기만.
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './backup.mjs'

const [base, envFile, flag] = process.argv.slice(2)
const env = loadEnv(envFile)
if (env.NEXT_PUBLIC_SUPABASE_URL.includes('xambccrcircnlbnuhfcw')) { console.error('운영 DB 주소입니다.'); process.exit(1) }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
const add = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const DEPTS = ['간호부(시험)', '원무팀(시험)', '재활치료팀(시험)']

async function clean() {
  const { data: e } = await db.from('employees').select('id').like('employee_number', 'S%')
  if (e?.length) await db.from('employees').delete().in('id', e.map((x) => x.id))
  await db.from('challenges').delete().like('title', '%(시험)')
  const { data: d } = await db.from('departments').select('id').in('name', DEPTS)
  if (d?.length) { await db.from('employee_departments').delete().in('department_id', d.map((x) => x.id)); await db.from('departments').delete().in('id', d.map((x) => x.id)) }
}
await clean()
if (flag === '--clean') { console.log('정리 끝'); process.exit(0) }

const names = ['김도윤', '이서연', '박지호', '최하은', '정민준', '한유진']
const { data: emps } = await db.from('employees').insert(names.map((n, i) => ({ name: n, employee_number: `S${String(i + 1).padStart(3, '0')}`, created_at: '2026-09-01T00:00:00+09:00' }))).select('id, name')
const types = (await db.from('exercise_types').select('id, name')).data
const logs = []
emps.forEach((e, i) => {
  for (let d = 0; d < 20; d++) {
    if ((d + i) % 3 === 0) continue
    logs.push({ employee_id: e.id, exercise_type_id: types[(d + i) % types.length].id, log_date: add(TODAY, -d), duration_seconds: (20 + ((d * 7 + i * 11) % 50)) * 60, memo: d === 1 && i === 0 ? '퇴근길 한 정거장 먼저 내려서 걸었어요' : null })
  }
})
await db.from('exercise_logs').insert(logs)
const dIds = (await db.from('departments').insert(DEPTS.map((name, i) => ({ name, sort_order: 100 + i }))).select('id')).data.map((x) => x.id)
await db.from('employee_departments').insert(emps.map((e, i) => ({ employee_id: e.id, department_id: dIds[i % 3], start_date: '2026-09-01' })))
await db.from('department_headcounts').insert([{ department_id: dIds[0], year_month: TODAY.slice(0, 7), headcount: 4, source: '시험 자료' }, { department_id: dIds[1], year_month: TODAY.slice(0, 7), headcount: 3, source: '시험 자료' }])
const ch = (await db.from('challenges').insert([
  { title: '11월 걷기 2주(시험)', description: '점심시간 15분이면 충분해요', metric: 'active_days', target: 8, start_date: add(TODAY, -6), end_date: add(TODAY, 7) },
  { title: '주말 300분(시험)', description: null, metric: 'minutes', target: 300, start_date: add(TODAY, 2), end_date: add(TODAY, 9) },
]).select('id')).data
await db.from('challenge_participants').insert(emps.slice(0, 4).map((e) => ({ challenge_id: ch[0].id, employee_id: e.id })))
await db.from('personal_goals').insert({ employee_id: emps[0].id, kind: 'sessions', target: 4, effective_from: add(TODAY, -((new Date(`${TODAY}T00:00:00Z`).getUTCDay() + 6) % 7)) })

// 김도윤 PIN: 관리자 발급 → 변경(583921)
class Device { constructor() { this.jar = new Map() }
  async call(p, o = {}) { const r = await fetch(base + p, { method: o.method ?? 'GET', headers: { 'x-sgrh-request': '1', 'Content-Type': 'application/json', ...(this.jar.size ? { Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined })
    for (const c of r.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); this.jar.set(k.trim(), v) } return r.json() } }
const admin = new Device()
await admin.call('/api/verify-admin', { method: 'POST', body: { password: env.ADMIN_PASSWORD } })
const temp = (await admin.call('/api/admin/pins', { method: 'POST', body: { mode: 'reset', employeeId: emps[0].id } })).issued[0].pin
const me = new Device()
await me.call('/api/auth/login', { method: 'POST', body: { employeeId: emps[0].id, pin: temp } })
await me.call('/api/auth/change-pin', { method: 'POST', body: { currentPin: temp, newPin: '583921' } })
console.log(`준비 끝: 직원 ${emps.length}명, 기록 ${logs.length}건, 부서 3, 챌린지 2. 화면 로그인: 김도윤 / 583921`)
