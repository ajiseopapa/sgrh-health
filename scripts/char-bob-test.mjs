// 단발녀(햇빛 50 캐릭터) 시험 — 시험 DB 전용. dev 서버가 떠 있어야 합니다.
//   node scripts/char-bob-test.mjs [http://localhost:3576]   (GARDEN_TEST_PIN = 시험 직원 S001 PIN)
// 1부: 안 산 상태(고르기 403, 햇빛이 모자라면 409). 2부(인자 --owned): 시험 DB에 char_bob 구매가 있을 때 고르기·되돌리기
import fs from 'node:fs'
const H = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:3576'
const OWNED = process.argv.includes('--owned')
const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
if (!env.includes('tqmacchjfkziftziwhrn')) { console.error('시험 DB 가 아님 — 중단'); process.exit(1) }
const PIN = process.env.GARDEN_TEST_PIN
if (!PIN) { console.error('GARDEN_TEST_PIN 필요'); process.exit(1) }
let ck = ''
const call = async (p, o = {}) => {
  const r = await fetch(H + p, { method: o.method || 'GET', headers: { 'x-sgrh-request': '1', 'Content-Type': 'application/json', Origin: H, cookie: ck }, body: o.body ? JSON.stringify(o.body) : undefined })
  for (const c of r.headers.getSetCookie?.() || []) { const kv = c.split(';')[0]; if (!kv.endsWith('=')) ck = (ck ? ck + '; ' : '') + kv }
  return { status: r.status, ...(await r.json().catch(() => ({}))) }
}
let pass = 0, fail = 0
const check = (n, c, x = '') => { if (c) { pass++; console.log('  ✅', n) } else { fail++; console.log('  ❌', n, x) } }
const s = (await call('/api/employees')).employees.find((e) => e.employee_number === 'S001')
check('로그인', (await call('/api/auth/login', { method: 'POST', body: { employeeId: s.id, pin: PIN } })).status === 200)
const pick = (character) => call('/api/me/game/profile', { method: 'PUT', body: { character } })
let g = await call('/api/me/game')
const before = g.characterKey
if (!OWNED) {
  check('기본 캐릭터 2종은 고를 수 있음', g.ownedCharacters?.includes('m') && g.ownedCharacters?.includes('f'))
  check('안 산 단발녀는 목록에 없음', !g.ownedCharacters?.includes('b'), JSON.stringify(g.ownedCharacters))
  const r = await pick('b')
  check('안 산 단발녀 고르기 403', r.status === 403 && r.code === 'not_owned', JSON.stringify(r))
  check('없는 캐릭터 400', (await pick('z')).status === 400)
  const b = await call('/api/me/game/purchase', { method: 'POST', body: { item: 'char_bob' } })
  if (g.sunlight.balance < 50) check('햇빛 모자라면 구매 409', b.status === 409 && b.code === 'insufficient', JSON.stringify(b))
  else check('햇빛 50으로 구매 200', b.status === 200 && b.game.sunlight.balance === g.sunlight.balance - 50)
  check('없는 캐릭터 구매 400', (await call('/api/me/game/purchase', { method: 'POST', body: { item: 'char_nope' } })).status === 400)
} else {
  check('산 단발녀는 목록에 있음', g.ownedCharacters?.includes('b'))
  check('구매 내역 이름 = 단발녀 구매', g.ledger.some((l) => l.label === '단발녀 구매'))
  check('다시 사기 409(이미 가짐)', (await call('/api/me/game/purchase', { method: 'POST', body: { item: 'char_bob' } })).status === 409)
  check('단발녀 고르기 200', (await pick('b')).status === 200)
  g = await call('/api/me/game')
  check('저장된 캐릭터 b', g.characterKey === 'b')
  const peer = await call(`/api/game/profile?id=${s.id}`)
  check('동료에게도 단발녀로 보임', peer.profile?.character === 'b')
  check('원래 캐릭터로 되돌리기 200', (await pick(before && before !== 'b' ? before : 'm')).status === 200)
}
console.log(`\n결과: ${pass} 통과 / ${fail} 실패`)
process.exit(fail ? 1 : 0)
