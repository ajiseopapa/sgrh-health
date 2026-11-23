// 보안·기능 자동 시험 — ⚠️ 시험 DB에 연결된 로컬 서버에서만 실행
//
// 사용법:
//   node scripts/security-test.mjs <서버 주소> <env 파일> [--after-lock]
//   예) node scripts/security-test.mjs http://localhost:3574 .env.local
//   019(쓰기 차단) 실행 후에는 --after-lock 을 붙여 "브라우저 직접 쓰기 차단"까지 확인합니다.
//
// 시험 직원(T001~T003)의 PIN을 새로 발급하고 기록을 만들었다 지웁니다. 운영 DB에서 돌리지 마세요.
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './backup.mjs'

const [base, envFile, flag] = process.argv.slice(2)
if (!base || !envFile) {
  console.error('사용법: node scripts/security-test.mjs <서버 주소> <env 파일> [--after-lock]')
  process.exit(1)
}
const AFTER_LOCK = flag === '--after-lock'
const env = loadEnv(envFile)
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const results = []
function check(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// 기기 하나 = 쿠키 통 하나
class Device {
  constructor() { this.jar = new Map() }
  async call(path, { method = 'GET', body, headers = {}, csrf = true } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(csrf ? { 'x-sgrh-request': '1' } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.jar.size ? { Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    })
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair, ...attrs] = c.split(';')
      const [k, v] = pair.split('=')
      const maxAge0 = attrs.some((a) => /max-age=0/i.test(a))
      if (!v || maxAge0) this.jar.delete(k.trim())
      else this.jar.set(k.trim(), v.trim())
      this.lastCookieAttrs = attrs.map((a) => a.trim().toLowerCase())
    }
    const json = await res.json().catch(() => ({}))
    return { status: res.status, ...json }
  }
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

async function main() {
  const { data: emps } = await service.from('employees').select('id, name, employee_number').in('employee_number', ['T001', 'T002', 'T003', 'T004'])
  const E = Object.fromEntries((emps ?? []).map((e) => [e.employee_number, e]))
  if (!E.T001 || !E.T002 || !E.T003) throw new Error('시험 직원 T001~T003이 없어요. 000_test_setup.sql을 먼저 실행하세요.')
  const { data: type } = await service.from('exercise_types').select('id').limit(1).single()

  // 시험 시작 전 요청 제한 기록 초기화 (시험 DB 전용)
  await service.from('rate_limits').delete().neq('bucket', '')

  // ── 1. 관리자 인증 ──
  const admin = new Device()
  let r = await admin.call('/api/admin/pins', { method: 'POST', body: { mode: 'missing' } })
  check('관리자 세션 없이 PIN 발급 거부', r.status === 401, `status ${r.status}`)
  r = await admin.call('/api/verify-admin', { method: 'POST', body: { password: 'wrong-password' } })
  check('틀린 관리자 비밀번호 거부', r.status === 401)
  r = await admin.call('/api/verify-admin', { method: 'POST', body: { password: env.ADMIN_PASSWORD } })
  check('관리자 로그인', r.ok === true)
  check('관리자 쿠키 HttpOnly·SameSite', (admin.lastCookieAttrs ?? []).includes('httponly') && (admin.lastCookieAttrs ?? []).some((a) => a.startsWith('samesite=lax')))
  check('관리자 쿠키 8시간', (admin.lastCookieAttrs ?? []).includes('max-age=28800'))

  // ── 2. 임시 PIN 발급 (시험 직원만 초기화) ──
  const pins = {}
  for (const k of ['T001', 'T002', 'T003']) {
    r = await admin.call('/api/admin/pins', { method: 'POST', body: { mode: 'reset', employeeId: E[k].id } })
    pins[k] = r.issued?.[0]?.pin
  }
  check('임시 PIN 6자리 발급', Object.values(pins).every((p) => /^\d{6}$/.test(p ?? '')))
  const { data: pinRows } = await service.from('employee_pins').select('pin_hash').eq('employee_id', E.T001.id).single()
  check('DB에 PIN 원문 없음(scrypt 해시)', pinRows.pin_hash.startsWith('scrypt$') && !pinRows.pin_hash.includes(pins.T001))

  // ── 3. 인증 없는 기록 작성 차단 ──
  const nobody = new Device()
  const logBody = (rid) => ({ requestId: rid, exerciseTypeId: type.id, logDate: today(), durationSeconds: 1800, distanceKm: null, memo: '보안시험' })
  r = await nobody.call('/api/logs', { method: 'POST', body: logBody('rid-nobody-0001') })
  check('본인 확인 없이 기록 작성 거부', r.status === 401)

  // ── 4. 임시 PIN 상태에서는 기록 불가 ──
  const a1 = new Device()
  r = await a1.call('/api/auth/login', { method: 'POST', body: { employeeId: E.T001.id, pin: pins.T001 } })
  check('임시 PIN 로그인 → 변경 요구', r.ok === true && r.mustChangePin === true)
  check('직원 쿠키 90일', (a1.lastCookieAttrs ?? []).includes(`max-age=${90 * 86400}`))
  r = await a1.call('/api/logs', { method: 'POST', body: logBody('rid-temp-00001') })
  check('임시 PIN 상태에서 기록 거부', r.status === 403 && r.mustChangePin === true)

  // ── 5. PIN 변경 규칙 + 다른 기기 세션 무효화 ──
  const a2 = new Device() // 같은 직원의 다른 기기
  await a2.call('/api/auth/login', { method: 'POST', body: { employeeId: E.T001.id, pin: pins.T001 } })
  r = await a1.call('/api/auth/change-pin', { method: 'POST', body: { currentPin: pins.T001, newPin: '123456' } })
  check('쉬운 PIN(123456) 거부', r.status === 400)
  r = await a1.call('/api/auth/change-pin', { method: 'POST', body: { currentPin: pins.T001, newPin: '12345' } })
  check('6자리 아닌 PIN 거부', r.status === 400)
  const NEW1 = '730415'
  r = await a1.call('/api/auth/change-pin', { method: 'POST', body: { currentPin: pins.T001, newPin: NEW1 } })
  check('PIN 변경', r.ok === true)
  r = await a2.call('/api/auth/me')
  check('PIN 변경 후 다른 기기 로그인 해제', r.me === null)
  r = await a1.call('/api/auth/me')
  check('PIN 변경한 기기는 유지', r.me?.id === E.T001.id && r.mustChangePin === false)

  // ── 6. CSRF ──
  r = await a1.call('/api/logs', { method: 'POST', body: logBody('rid-csrf-00001'), csrf: false })
  check('CSRF: 전용 헤더 없는 요청 거부', r.status === 403)
  r = await a1.call('/api/logs', { method: 'POST', body: logBody('rid-csrf-00002'), headers: { Origin: 'https://evil.example.com' } })
  check('CSRF: 다른 사이트 Origin 거부', r.status === 403)

  // ── 7. 입력값 검증 ──
  r = await a1.call('/api/logs', { method: 'POST', body: { ...logBody('rid-val-000001'), durationSeconds: 0 } })
  check('운동 시간 없는 기록 거부', r.status === 400)
  r = await a1.call('/api/logs', { method: 'POST', body: { ...logBody('rid-val-000002'), logDate: '2999-01-01' } })
  check('미래 날짜 거부', r.status === 400)
  r = await a1.call('/api/logs', { method: 'POST', body: { ...logBody('rid-val-000003'), memo: 'x'.repeat(301) } })
  check('메모 길이 제한', r.status === 400)
  r = await a1.call('/api/logs', { method: 'POST', body: { ...logBody('rid-val-000004'), employeeId: E.T002.id } })
  const { data: spoof } = await service.from('exercise_logs').select('employee_id').eq('client_request_id', 'rid-val-000004').maybeSingle()
  check('화면이 보낸 직원 ID는 무시(본인 이름으로만 저장)', r.ok === true && !!spoof && spoof.employee_id === E.T001.id)
  if (spoof) await service.from('exercise_logs').delete().eq('client_request_id', 'rid-val-000004')

  // ── 8. 중복 방지 ──
  const rid = `rid-dup-${Date.now()}`
  const [d1, d2] = await Promise.all([
    a1.call('/api/logs', { method: 'POST', body: { ...logBody(rid), durationSeconds: 2222 } }),
    a1.call('/api/logs', { method: 'POST', body: { ...logBody(rid), durationSeconds: 2222 } }),
  ])
  const { count: dupCount } = await service.from('exercise_logs').select('id', { count: 'exact', head: true }).eq('client_request_id', rid)
  check('같은 요청 번호 동시 2회 → 1건만 저장', dupCount === 1, `저장 ${dupCount}건, 응답 ${d1.status}/${d2.status}`)
  r = await a1.call('/api/logs', { method: 'POST', body: { ...logBody(`${rid}-b`), durationSeconds: 2222 } })
  check('1분 안 같은 내용 재기록 차단', r.status === 409)
  const myLogId = d1.id ?? d2.id

  // ── 9. 남의 기록 수정·삭제 ──
  const b = new Device()
  await b.call('/api/auth/login', { method: 'POST', body: { employeeId: E.T002.id, pin: pins.T002 } })
  await b.call('/api/auth/change-pin', { method: 'POST', body: { currentPin: pins.T002, newPin: '582913' } })
  r = await b.call(`/api/logs/${myLogId}`, { method: 'PATCH', body: logBody('x') })
  check('남의 기록 수정 거부', r.status === 403)
  r = await b.call(`/api/logs/${myLogId}`, { method: 'DELETE' })
  check('남의 기록 삭제 거부', r.status === 403)
  r = await a1.call(`/api/logs/${myLogId}`, { method: 'PATCH', body: { ...logBody('x'), durationSeconds: 2400 } })
  check('내 기록 수정', r.ok === true)
  r = await admin.call(`/api/logs/${myLogId}`, { method: 'PATCH', body: { ...logBody('x'), durationSeconds: 2500 } })
  check('관리자는 모든 기록 수정 가능', r.ok === true)
  const { data: audits } = await service.from('audit_logs').select('action').eq('record_id', myLogId)
  check('감사 로그 기록(작성·수정)', (audits ?? []).filter((x) => x.action === 'update').length >= 2 && (audits ?? []).some((x) => x.action === 'insert'))

  // ── 10. 응원 (익명, 기기 기준) ──
  r = await nobody.call('/api/reactions', { method: 'POST', body: { logId: myLogId, deviceId: 'device-test-0001', emoji: '👏' } })
  check('응원 누르기', r.action === 'added')
  r = await nobody.call('/api/reactions', { method: 'POST', body: { logId: myLogId, deviceId: 'device-test-0001', emoji: '👏' } })
  check('같은 기기 다시 누르면 취소', r.action === 'removed')
  r = await nobody.call('/api/reactions', { method: 'POST', body: { logId: myLogId, deviceId: 'device-test-0001', emoji: '💩' } })
  check('허용되지 않은 이모지 거부', r.status === 400)

  // ── 11. 5회 실패 잠금 ──
  const c = new Device()
  let last
  for (let i = 0; i < 5; i++) last = await c.call('/api/auth/login', { method: 'POST', body: { employeeId: E.T003.id, pin: '000001' } })
  check('5회 틀리면 잠금', last.status === 423)
  r = await c.call('/api/auth/login', { method: 'POST', body: { employeeId: E.T003.id, pin: pins.T003 } })
  check('잠긴 동안은 맞는 PIN도 거부', r.status === 423)

  // ── 12. PIN 초기화 → 세션 무효화 ──
  await admin.call('/api/admin/pins', { method: 'POST', body: { mode: 'reset', employeeId: E.T001.id } })
  r = await a1.call('/api/auth/me')
  check('관리자 PIN 초기화 후 그 직원 로그인 해제', r.me === null)

  // ── 13. 로그아웃 = 서버 세션 삭제 ──
  const cookieBefore = [...b.jar.values()][0]
  await b.call('/api/auth/logout', { method: 'POST' })
  const replay = new Device(); replay.jar.set('sgrh_me', cookieBefore)
  r = await replay.call('/api/auth/me')
  check('로그아웃한 쿠키를 다시 써도 무효', r.me === null)

  // ── 14. 관리자 로그아웃 ──
  const adminCookie = admin.jar.get('sgrh_admin')
  await admin.call('/api/admin/logout', { method: 'POST' })
  const adminReplay = new Device(); adminReplay.jar.set('sgrh_admin', adminCookie)
  r = await adminReplay.call('/api/admin/employees')
  check('관리자 로그아웃 후 쿠키 재사용 거부', r.status === 401)

  // ── 15. 브라우저(공개 키) 직접 접근 ──
  for (const t of ['employee_pins', 'auth_sessions', 'audit_logs', 'rate_limits', 'employee_goals']) {
    const { data, error } = await anon.from(t).select('*').limit(1)
    check(`공개 키로 ${t} 읽기 차단`, !!error || (data ?? []).length === 0)
  }
  const { data: rpcData, error: rpcErr } = await anon.rpc('hit_rate_limit', { p_bucket: 'x', p_limit: 1, p_window_seconds: 1 })
  check('공개 키로 요청 제한 함수 실행 차단', !!rpcErr && rpcData == null)

  const { data: ins, error: insErr } = await anon
    .from('exercise_logs')
    .insert({ employee_id: E.T002.id, exercise_type_id: type.id, log_date: today(), duration_seconds: 60, memo: '우회시험' })
    .select('id')
  if (AFTER_LOCK) {
    check('전환 2: 공개 키로 기록 직접 작성 차단', !!insErr || !ins?.length)
    const { data: upd } = await anon.from('employees').update({ name: '우회' }).eq('id', E.T002.id).select('id')
    check('전환 2: 공개 키로 직원 정보 변경 차단', !upd?.length)
    const { data: del } = await anon.from('exercise_logs').delete().eq('id', myLogId).select('id')
    check('전환 2: 공개 키로 기록 삭제 차단', !del?.length)
  } else {
    check('(참고) 전환 1: 공개 키 직접 작성은 아직 열려 있음 — 019 실행 후 막힘', !insErr && !!ins?.length, '예상된 결과')
    if (ins?.length) await service.from('exercise_logs').delete().eq('id', ins[0].id)
  }

  // ── 16. 요청 제한 (마지막에 실행) ──
  // ① DB 함수 자체: 한도 3이면 4번째에서 막혀야 함
  const hits = []
  for (let i = 0; i < 4; i++) {
    const { data } = await service.rpc('hit_rate_limit', { p_bucket: 'selftest', p_limit: 3, p_window_seconds: 60 })
    hits.push(data)
  }
  check('요청 제한 함수: 한도 초과 시 차단', hits.join(',') === 'true,true,true,false', hits.join(','))

  // ② 로그인 API: 같은 IP에서 "실패"가 10분 30회를 넘으면 맞는 PIN도 429
  //    (병원 공용 IP 때문에 성공한 로그인은 넉넉한 300회 한도만 적용)
  await service.from('rate_limits').delete().neq('bucket', '')
  const d = new Device()
  let limitedAt = 0
  for (let i = 1; i <= 35 && !limitedAt; i++) {
    // T004는 PIN이 없는 직원 → "계정 훑어보기" 실패로 셈 (직원별 잠금과 무관하게 IP 실패만 증가)
    const x = await d.call('/api/auth/login', { method: 'POST', body: { employeeId: E.T004?.id ?? E.T003.id, pin: '999999' } })
    if (x.status === 429) limitedAt = i
  }
  check('IP별 실패 로그인 제한(10분 30회)', limitedAt === 31, `${limitedAt}번째에서 차단`)
  r = await d.call('/api/auth/login', { method: 'POST', body: { employeeId: E.T002.id, pin: '582913' } })
  check('실패 한도 초과 IP는 맞는 PIN도 차단', r.status === 429)

  // 정리: 시험 기록 삭제
  await service.from('exercise_logs').delete().eq('memo', '보안시험')
  await service.from('rate_limits').delete().neq('bucket', '')

  const failed = results.filter((x) => !x.pass)
  console.log(`\n결과: ${results.length - failed.length}/${results.length} 통과`)
  process.exit(failed.length ? 2 : 0)
}

main().catch((e) => { console.error('시험 중단:', e.message); process.exit(1) })
