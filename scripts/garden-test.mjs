// 나의 정원 1단계(꾸미기) 시험 — 시험 DB 전용. 실행 전 dev 서버가 떠 있어야 합니다.
//   node scripts/garden-test.mjs [http://localhost:3576]
// 시험 직원 S001(김도윤)로 로그인합니다. PIN 은 환경변수 GARDEN_TEST_PIN (시험 DB 전용 값).
// 끝나면 이 시험이 만든 구매·배치를 지우지 않습니다(화면 확인용). 다시 돌리려면 시험 DB에서 S001 의 decor_ 구매를 지우세요.
import fs from 'node:fs'

const H = process.argv[2] || 'http://localhost:3576'
const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
if (!env.includes('tqmacchjfkziftziwhrn')) { console.error('시험 DB 가 아님 — 중단'); process.exit(1) }
const PIN = process.env.GARDEN_TEST_PIN
if (!PIN) { console.error('GARDEN_TEST_PIN 필요'); process.exit(1) }

function client() {
  let ck = ''
  return async (p, o = {}) => {
    const r = await fetch(H + p, { method: o.method || 'GET', headers: { 'x-sgrh-request': '1', 'Content-Type': 'application/json', Origin: H, cookie: ck }, body: o.body ? JSON.stringify(o.body) : undefined })
    for (const c of r.headers.getSetCookie?.() || []) { const kv = c.split(';')[0]; if (!kv.endsWith('=')) ck = (ck ? ck + '; ' : '') + kv }
    return { status: r.status, ...(await r.json().catch(() => ({}))) }
  }
}
let pass = 0, fail = 0
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✅', name) } else { fail++; console.log('  ❌', name, extra) } }

const me = client(), anon = client()
const emps = (await anon('/api/employees')).employees
const s = emps.find((e) => e.employee_number === 'S001')
check('로그인', (await me('/api/auth/login', { method: 'POST', body: { employeeId: s.id, pin: PIN } })).status === 200)

const place = (slot, item, c = me) => c('/api/me/game/garden', { method: 'PUT', body: { slot, item } })
const buy = (item) => me('/api/me/game/purchase', { method: 'POST', body: { item } })
const game = async () => (await me('/api/me/game'))

let g = await game()
check('정원 준비됨(033 적용)', g.garden?.ready === true)
check('칸 8개', g.garden?.slots?.length === 8)
const start = g.sunlight.balance
console.log('  시작 잔액', start, '가진 장식', g.garden.owned)

console.log('— 거부되는 요청')
check('로그인 없이 놓기 401', (await place(0, 'decor_tulip', anon)).status === 401)
check('안 가진 장식 놓기 403', g.garden.owned.includes('decor_fountain') || (await place(0, 'decor_fountain')).status === 403)
check('캐릭터 아이템 놓기 400', (await place(0, 'hat_cap')).status === 400)
check('없는 장식 400', (await place(0, 'decor_nothing')).status === 400)
check('칸 범위 밖(8) 400', (await place(8, 'decor_tulip')).status === 400)
check('칸 범위 밖(-1) 400', (await place(-1, null)).status === 400)
check('칸이 숫자가 아님 400', (await place('0', null)).status === 400)
check('장식 값 없음 400', (await me('/api/me/game/garden', { method: 'PUT', body: { slot: 0 } })).status === 400)
check('없는 장식 구매 400', (await buy('decor_nothing')).status === 400)

console.log('— 구매')
if (!g.garden.owned.includes('decor_tulip')) {
  const b = await buy('decor_tulip')
  check('튤립 구매 200', b.status === 200, JSON.stringify(b).slice(0, 120))
  check('잔액 30 줄어듦', b.game?.sunlight.balance === start - 30)
  check('가진 장식에 튤립', b.game?.garden.owned.includes('decor_tulip'))
  check('캐릭터 아이템 목록에는 안 섞임', !b.game?.character.owned.includes('decor_tulip'))
  check('내역에 "튤립 구매"', b.game?.ledger.some((l) => l.label === '튤립 구매' && l.points === -30))
}
check('같은 장식 다시 구매 409', (await buy('decor_tulip')).status === 409)
// 동시 구매: 같은 장식 5번 동시에 → 성공은 많아야 1번
if (!g.garden.owned.includes('decor_sunflower')) {
  const rs = await Promise.all(Array.from({ length: 5 }, () => buy('decor_sunflower')))
  check('동시 구매 5번 중 성공 1번', rs.filter((r) => r.status === 200).length === 1, rs.map((r) => r.status).join(','))
}
g = await game()
check('쓴 햇빛 = 가격 합(70)', g.sunlight.spent === 70, String(g.sunlight.spent))
const rest = g.sunlight.balance
const tooDear = await buy('decor_fountain')
check(`잔액 ${rest}으로 분수(120) 구매 409`, rest >= 120 || (tooDear.status === 409 && tooDear.code === 'insufficient'), JSON.stringify(tooDear).slice(0, 100))

console.log('— 놓기·옮기기·바꾸기·빼기')
let r = await place(0, 'decor_tulip')
check('튤립 0번 칸에 놓기', r.status === 200 && r.game.garden.slots[0] === 'decor_tulip')
r = await place(0, 'decor_tulip')
check('같은 칸에 다시 놓아도 그대로', r.status === 200 && r.game.garden.slots.filter((x) => x === 'decor_tulip').length === 1)
r = await place(5, 'decor_tulip')
check('튤립 5번 칸으로 옮김(0번은 빔)', r.game.garden.slots[5] === 'decor_tulip' && r.game.garden.slots[0] === null)
r = await place(0, 'decor_sunflower')
check('해바라기 0번 칸에 놓기', r.game.garden.slots[0] === 'decor_sunflower')
r = await place(0, 'decor_tulip')
check('튤립을 해바라기 칸으로 → 서로 자리 바뀜', r.game.garden.slots[0] === 'decor_tulip' && r.game.garden.slots[5] === 'decor_sunflower', JSON.stringify(r.game?.garden.slots))
check('같은 장식이 두 칸에 없음', r.game.garden.slots.filter((x) => x === 'decor_tulip').length === 1)
r = await place(5, null)
check('5번 칸 빼기 → 빔, 해바라기는 가진 채로', r.game.garden.slots[5] === null && r.game.garden.owned.includes('decor_sunflower'))
r = await place(5, null)
check('빈 칸 빼기도 오류 없음', r.status === 200)
r = await place(7, 'decor_sunflower')
check('빼 둔 해바라기 7번 칸에 다시 놓기', r.game.garden.slots[7] === 'decor_sunflower')
// 동시 놓기: 같은 장식을 서로 다른 칸에 동시에 → 결국 한 칸에만
const many = await Promise.all([1, 2, 3, 4].map((sl) => place(sl, 'decor_tulip')))
g = await game()
check('동시 놓기 뒤에도 튤립은 한 칸에만', many.every((x) => x.status === 200) && g.garden.slots.filter((x) => x === 'decor_tulip').length === 1, JSON.stringify(g.garden.slots))
check('잔액은 놓기·옮기기로 변하지 않음', g.sunlight.balance === rest)

console.log('— 남에게 영향 없음')
const other = emps.find((e) => e.id !== s.id)
const prof = await anon(`/api/game/profile?id=${other.id}`)
check('다른 직원 프로필 조회 정상', prof.status === 200)
check('공개 API 에 내 정원 정보가 섞여 나가지 않음', !JSON.stringify(await anon(`/api/game/profile?id=${s.id}`)).includes('decor_'))

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`)
process.exit(fail ? 1 : 0)
