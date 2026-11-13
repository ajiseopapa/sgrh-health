// 운영 점검 — 운영 데이터를 바꾸지 않는 시험만 합니다.
//
// 사용법:
//   node scripts/prod-check.mjs https://sgrh-health.vercel.app [운영 env 파일] [--after-lock]
//
// - env 파일 없이: HTTP 점검만 (로그인 없는 요청이 막히는지)
// - env 파일(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY만 있으면 됨): 공개 키 직접 접근 점검 추가
// - --after-lock: 019 실행 뒤 "공개 키 직접 쓰기 차단"까지 확인
// - --after-023: 023 실행 뒤 "공개 키로 races 읽기·쓰기 차단" 확인
// - --after-022: 022 실행 뒤 "응원 기기 식별값 공개 읽기 차단"과 새 응원 요약 API까지 확인
//
// 쓰기 시도는 모두 "존재하지 않는 직원·기록 ID"로만 합니다.
//   차단돼 있으면 → 권한 오류(42501)
//   열려 있으면   → 외래키 오류(23503)로 실패 (어느 쪽이든 운영 데이터는 바뀌지 않음)
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './backup.mjs'

const args = process.argv.slice(2)
const base = args[0]?.replace(/\/$/, '')
const envFile = args.find((a, i) => i > 0 && !a.startsWith('--'))
const AFTER_LOCK = args.includes('--after-lock')
const AFTER_022 = args.includes('--after-022')
const AFTER_023 = args.includes('--after-023')
if (!base?.startsWith('https://') && !base?.startsWith('http://localhost')) {
  console.error('사용법: node scripts/prod-check.mjs https://주소 [env 파일] [--after-lock]')
  process.exit(1)
}

const results = []
const check = (name, pass, detail = '') => {
  results.push(pass)
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const FAKE = '00000000-0000-4000-8000-000000000000'

async function http(path, { method = 'GET', body, csrf = true, origin } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(csrf ? { 'x-sgrh-request': '1' } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

console.log(`대상: ${base}\n── HTTP 점검 (데이터 변경 없음) ──`)
let r = await http('/')
check('첫 화면 열림', r.status === 200, `status ${r.status}`)
r = await http('/api/auth/me')
check('새 버전 배포됨 (/api/auth/me)', r.status === 200 && r.json.ok === true, `status ${r.status}`)
check('로그인 안 한 상태로 표시', r.json.me === null && r.json.isAdmin === false)

const fakeLog = { requestId: 'prodcheck-0000', exerciseTypeId: FAKE, logDate: '2026-01-01', durationSeconds: 60 }
r = await http('/api/logs', { method: 'POST', body: fakeLog })
check('로그인 없는 기록 작성 차단', r.status === 401, `status ${r.status}`)
r = await http('/api/logs', { method: 'POST', body: fakeLog, csrf: false })
check('CSRF: 전용 헤더 없는 요청 차단', r.status === 403, `status ${r.status}`)
r = await http('/api/logs', { method: 'POST', body: fakeLog, origin: 'https://evil.example.com' })
check('CSRF: 다른 사이트 Origin 차단', r.status === 403, `status ${r.status}`)
r = await http(`/api/logs/${FAKE}`, { method: 'DELETE' })
check('로그인 없는 기록 삭제 차단', r.status === 401 || r.status === 404, `status ${r.status}`)

for (const [path, method] of [
  ['/api/admin/employees', 'GET'],
  ['/api/admin/pins', 'POST'],
  [`/api/admin/employees/${FAKE}`, 'DELETE'],
  ['/api/admin/exercise-types', 'POST'],
  ['/api/admin/announcements', 'POST'],
  [`/api/admin/suggestions/${FAKE}`, 'DELETE'],
]) {
  r = await http(path, { method, body: method === 'GET' ? undefined : { mode: 'missing' } })
  // 건의 API는 폐지(028)되어 누구에게나 410
  const okStatus = path.includes('/suggestions/') ? [401, 410] : [401]
  check(`관리자 권한 없이 ${method} ${path} 차단`, okStatus.includes(r.status), `status ${r.status}`)
}
r = await http('/api/auth/login', { method: 'POST', body: { employeeId: FAKE, pin: '000000' } })
check('없는 직원 로그인 거부', r.status === 400 || r.status === 429, `status ${r.status}`)

if (envFile && existsSync(envFile)) {
  const env = loadEnv(envFile)
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  console.log('\n── 공개 키 직접 접근 점검 (데이터 변경 없음) ──')

  for (const t of ['employee_pins', 'auth_sessions', 'audit_logs', 'rate_limits', 'employee_goals']) {
    const { data, error } = await anon.from(t).select('*').limit(1)
    check(`공개 키로 ${t} 읽기 차단`, !!error || (data ?? []).length === 0)
  }
  for (const t of ['employees', 'exercise_logs', 'exercise_types']) {
    const { error } = await anon.from(t).select('id').limit(1)
    check(`화면용 읽기 정상: ${t}`, !error, error?.message ?? '')
  }

  if (AFTER_022) {
    // 응원 행을 직접 읽으면 0행이어야 함(기기 식별값 노출 차단). 요약 API는 숫자만 돌려줌
    const { data, error } = await anon.from('log_reactions').select('device_id').limit(1)
    check('공개 키로 응원 기기 식별값 읽기 차단 (022)', !!error || (data ?? []).length === 0)
    const { data: someLogs } = await anon.from('exercise_logs').select('id').order('created_at', { ascending: false }).limit(20)
    const r = await http('/api/reactions/summary', { method: 'POST', body: { logIds: (someLogs ?? []).map((l) => l.id), deviceId: 'prodcheck-device-0000' } })
    check('응원 요약 API 동작 (숫자만, 기기 식별값 없음)', r.status === 200 && Array.isArray(r.json.cheers) && !JSON.stringify(r.json).includes('device'), `status ${r.status}`)
  }

  if (AFTER_023) {
    const { data, error } = await anon.from('races').select('id').limit(1)
    check('공개 키로 races 읽기 차단 (023)', !!error || (data ?? []).length === 0, error?.code ?? '')
    // 필수 칸 name을 일부러 빼서, 차단이 안 돼 있어도(23502) 운영에 행이 생기지 않게 함
    const { error: wErr } = await anon.from('races').insert({ race_date: '2026-01-01', location: 'x', distances: 'x' })
    check('공개 키로 races 넣기 차단 (023)', !!wErr && wErr.code === '42501', `오류 코드 ${wErr?.code}`)
  }

  const tries = [
    ['exercise_logs', { employee_id: FAKE, exercise_type_id: FAKE, log_date: '2026-01-01', duration_seconds: 60 }],
    ['log_reactions', { log_id: FAKE, device_id: 'prodcheck', emoji: '👏' }],
    ['employee_goals', { employee_id: FAKE, year_month: '2026-01', goal_count: 1 }],
  ]
  for (const [t, row] of tries) {
    const { error } = await anon.from(t).insert(row)
    const code = error?.code ?? 'OK'
    if (AFTER_LOCK || t === 'employee_goals') {
      check(`공개 키로 ${t} 직접 작성 차단`, code === '42501', `오류 코드 ${code}`)
    } else {
      check(`(참고) 019 전: ${t} 직접 작성은 아직 열림`, code === '23503', `오류 코드 ${code} — 없는 ID라 저장 안 됨`)
    }
  }
}

const failed = results.filter((x) => !x).length
console.log(`\n결과: ${results.length - failed}/${results.length} 통과`)
process.exit(failed ? 2 : 0)
