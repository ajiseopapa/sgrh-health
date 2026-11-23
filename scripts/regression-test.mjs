// 기존 기능 회귀 시험 — 019(쓰기 차단) 이후에도 화면이 쓰는 경로가 모두 동작하는지
// 사용법: node scripts/regression-test.mjs <서버 주소> <env 파일>
// ⚠️ 시험 DB 전용. 시험용 공지·종목·직원·건의를 만들었다 지웁니다.
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './backup.mjs'

const [base, envFile] = process.argv.slice(2)
const env = loadEnv(envFile)
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const results = []
const check = (name, pass, detail = '') => { results.push(pass); console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`) }

const jar = new Map()
async function call(path, method = 'GET', body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'x-sgrh-request': '1',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (v) jar.set(k, v) }
  return { status: res.status, ...(await res.json().catch(() => ({}))) }
}

// ── 화면이 브라우저에서 바로 읽는 것들 (홈·통계·피드·기록·달력·공지·건의함) ──
for (const [t, sel] of [['employees', 'id, name, employee_number, color, created_at'], ['exercise_types', '*'], ['exercise_logs', '*, employee:employees(id, name, employee_number, color, created_at), exercise_type:exercise_types(*)'], ['log_reactions', '*'], ['announcements', '*'], ['suggestions', '*']]) {
  const { error } = await anon.from(t).select(sel).limit(5)
  check(`읽기: ${t}`, !error, error?.message ?? '')
}
const { count } = await anon.from('exercise_logs').select('*', { count: 'exact', head: true })
check('통계 탭 전체 건수 조회', typeof count === 'number', `${count}건`)

// ── 건의 작성 (019 이후에도 브라우저에서 허용) ──
const { error: sErr } = await anon.from('suggestions').insert({ employee_id: null, employee_name: null, title: '회귀시험', content: '회귀시험 건의' })
check('건의 작성(브라우저 직접)', !sErr, sErr?.message ?? '')
const { data: sug } = await service.from('suggestions').select('id').eq('title', '회귀시험').limit(1).single()

// ── 관리자 기능 (서버 API) ──
let r = await call('/api/verify-admin', 'POST', { password: env.ADMIN_PASSWORD })
check('관리자 로그인', r.ok === true)
r = await call('/api/auth/me'); check('관리자 표시', r.isAdmin === true)

r = await call('/api/admin/announcements', 'POST', { title: '회귀시험 공지', content: '내용' })
check('공지 작성', r.ok === true)
const { data: ann } = await anon.from('announcements').select('id').eq('title', '회귀시험 공지').single()
r = await call(`/api/admin/announcements/${ann.id}`, 'PATCH', { title: '회귀시험 공지', content: '수정' }); check('공지 수정', r.ok === true)
r = await call(`/api/admin/announcements/${ann.id}`, 'DELETE'); check('공지 삭제', r.ok === true)

r = await call(`/api/admin/suggestions/${sug.id}`, 'PATCH', { markRead: true }); check('건의 확인 처리', r.ok === true)
r = await call(`/api/admin/suggestions/${sug.id}`, 'PATCH', { reply: '답변' }); check('건의 답변', r.ok === true)
const { data: sug2 } = await anon.from('suggestions').select('status').eq('id', sug.id).single()
check('건의 상태 → 답변완료', sug2.status === 'answered')
r = await call(`/api/admin/suggestions/${sug.id}`, 'DELETE'); check('건의 삭제', r.ok === true)

r = await call('/api/admin/exercise-types', 'POST', { name: '회귀시험종목', icon: '🧪', trackDistance: true }); check('종목 등록', r.ok === true)
const { data: et } = await anon.from('exercise_types').select('id, track_distance').eq('name', '회귀시험종목').single()
check('종목 거리 추적 저장', et.track_distance === true)
r = await call(`/api/admin/exercise-types/${et.id}`, 'PATCH', { name: '회귀시험종목2', icon: '🧪', trackDistance: false }); check('종목 수정', r.ok === true)
r = await call(`/api/admin/exercise-types/${et.id}`, 'DELETE'); check('종목 삭제', r.ok === true)

const { data: used } = await anon.from('exercise_logs').select('exercise_type_id').limit(1).single()
r = await call(`/api/admin/exercise-types/${used.exercise_type_id}`, 'DELETE')
check('기록 있는 종목 삭제 막힘(기존 동작 유지)', r.status === 400, r.message)

r = await call('/api/admin/employees', 'POST', { name: '회귀시험직원', employeeNumber: 'R999' }); check('직원 등록', r.ok === true)
const empId = r.employee?.id
r = await call('/api/admin/employees', 'POST', { name: '중복', employeeNumber: 'R999' }); check('같은 사번 등록 막힘', r.status === 400, r.message)
r = await call(`/api/admin/employees/${empId}`, 'PATCH', { name: '회귀시험직원', employeeNumber: 'R999', color: '#FF6B6B' }); check('직원 수정(색상)', r.ok === true)
r = await call('/api/admin/employees'); check('직원 목록 + PIN 상태', Array.isArray(r.employees) && r.employees.some((e) => e.id === empId && e.pin_status === 'none'))
r = await call(`/api/admin/employees/${empId}`, 'DELETE'); check('직원 삭제', r.ok === true)

await service.from('audit_logs').select('id', { count: 'exact', head: true })
const { count: auditCount } = await service.from('audit_logs').select('id', { count: 'exact', head: true }).in('table_name', ['announcements', 'exercise_types', 'employees', 'suggestions'])
check('관리 동작 감사 로그 기록', (auditCount ?? 0) >= 9, `${auditCount}건`)

await call('/api/admin/logout', 'POST')
console.log(`\n결과: ${results.filter(Boolean).length}/${results.length} 통과`)
process.exit(results.every(Boolean) ? 0 : 2)
