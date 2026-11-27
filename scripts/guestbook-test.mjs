// 정원 방명록 시험 — 시험 DB 전용. 실행 전 dev 서버가 떠 있어야 합니다.
//   node scripts/guestbook-test.mjs [http://localhost:3576]
// 시험 직원 S001(김도윤)로 로그인합니다. PIN 은 환경변수 GARDEN_TEST_PIN (시험 DB 전용 값).
// 먼저 시험 DB에 '[시험]'으로 시작하는 글 2개를 넣어 두어야 합니다(주인 삭제·남의 글 거부 확인용):
//   ① 주인 S001 · 쓴 사람 S002 '[시험] 주인이 지울 글'   ② 주인 S002 · 쓴 사람 S003 '[시험] 남의 정원 남의 글'
import fs from 'node:fs'

const H = process.argv[2] || 'http://localhost:3576'
const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
if (!env.includes('tqmacchjfkziftziwhrn')) { console.error('시험 DB 가 아님 — 중단'); process.exit(1) }
const PIN = process.env.GARDEN_TEST_PIN
if (!PIN) { console.error('GARDEN_TEST_PIN 필요'); process.exit(1) }

function client() {
  let ck = ''
  return async (p, o = {}) => {
    const r = await fetch(H + p, { method: o.method || 'GET', headers: { 'x-sgrh-request': o.noCsrf ? '0' : '1', 'Content-Type': 'application/json', Origin: H, cookie: ck }, body: o.body ? JSON.stringify(o.body) : undefined })
    for (const c of r.headers.getSetCookie?.() || []) { const kv = c.split(';')[0]; if (!kv.endsWith('=')) ck = (ck ? ck + '; ' : '') + kv }
    return { status: r.status, ...(await r.json().catch(() => ({}))) }
  }
}
let pass = 0, fail = 0
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✅', name) } else { fail++; console.log('  ❌', name, extra) } }

const me = client(), anon = client()
const emps = (await anon('/api/employees')).employees
const byNo = (n) => emps.find((e) => e.employee_number === n)
const s1 = byNo('S001'), s2 = byNo('S002')
check('로그인', (await me('/api/auth/login', { method: 'POST', body: { employeeId: s1.id, pin: PIN } })).status === 200)

const list = (owner, c = me) => c(`/api/game/guestbook?id=${owner}`)
const write = (ownerId, body, c = me, o = {}) => c('/api/game/guestbook', { method: 'POST', body: { ownerId, body }, ...o })
const del = (id, c = me) => c('/api/game/guestbook', { method: 'DELETE', body: { id } })

console.log('— 거부되는 요청')
check('로그인 없이 읽기 401', (await list(s2.id, anon)).status === 401)
check('로그인 없이 쓰기 401', (await write(s2.id, '안녕', anon)).status === 401)
check('CSRF 헤더 없이 쓰기 403', (await write(s2.id, '안녕', me, { noCsrf: true })).status === 403)
check('잘못된 주인 id 읽기 400', (await list('nope')).status === 400)
check('잘못된 주인 id 쓰기 400', (await write('nope', '안녕')).status === 400)
check('없는 직원 정원 404', (await write('00000000-0000-4000-8000-000000000000', '안녕')).status === 404)
check('빈 글 400', (await write(s2.id, '   ')).status === 400)
check('글이 문자열 아님 400', (await write(s2.id, 123)).status === 400)
check('101자 400', (await write(s2.id, '가'.repeat(101))).status === 400)
check('잘못된 글 id 지우기 400', (await del('nope')).status === 400)

console.log('— 쓰기·읽기')
const stamp = `시험 ${Date.now()}`
const w = await write(s2.id, `  ${stamp}\n  정원 예뻐요!  `)
check('동료 정원에 남기기 200', w.status === 200 && !!w.id, JSON.stringify(w).slice(0, 120))
check('100자 딱 맞으면 200', (await write(s2.id, '나'.repeat(100))).status === 200)
let l = await list(s2.id)
check('읽기 200·준비됨', l.status === 200 && l.ready === true)
const mineEntry = l.entries?.find((e) => e.id === w.id)
check('공백 정리해서 저장', mineEntry?.body === `${stamp} 정원 예뻐요!`, mineEntry?.body)
check('최신 글이 맨 위', l.entries?.[0]?.body === '나'.repeat(100))
check('쓴 사람 이름', mineEntry?.author?.name === s1.name)
check('내 글은 지울 수 있음', mineEntry?.mine === true && mineEntry?.canDelete === true)
const others = l.entries?.find((e) => e.body === '[시험] 남의 정원 남의 글')
check('남의 정원 남의 글은 못 지움 표시', others && others.canDelete === false && others.mine === false)
check('남의 정원 남의 글 지우기 403', others && (await del(others.id)).status === 403)
check('응답에 PIN·사번 없음', !JSON.stringify(l).match(/pin|employee_number/i))

console.log('— 지우기')
check('내 글 지우기 200', (await del(w.id)).status === 200)
l = await list(s2.id)
check('지운 글은 목록에 없음', !l.entries.some((e) => e.id === w.id))
check('이미 지운 글 다시 지우기 200(무시)', (await del(w.id)).status === 200)
for (const e of l.entries.filter((e) => e.mine)) await del(e.id) // 100자 글 정리

const mine = await list(s1.id)
const toOwner = mine.entries?.find((e) => e.body === '[시험] 주인이 지울 글')
check('내 정원에 남긴 동료 글 보임·지울 수 있음', toOwner && toOwner.canDelete === true && toOwner.mine === false)
check('정원 주인이 동료 글 지우기 200', toOwner && (await del(toOwner.id)).status === 200)

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`)
process.exit(fail ? 1 : 0)
