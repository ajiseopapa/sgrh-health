// 나의 정원 시험 — 꾸미기(자유 배치)·구경. 시험 DB 전용. 실행 전 dev 서버가 떠 있어야 합니다.
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

const put = (item, x, y, c = me) => c('/api/me/game/garden', { method: 'PUT', body: { item, x, y } })
const takeOut = (item) => me('/api/me/game/garden', { method: 'PUT', body: { item, remove: true } })
const buy = (item) => me('/api/me/game/purchase', { method: 'POST', body: { item } })
const game = async () => (await me('/api/me/game'))
const at = (g, key) => g.garden.items.find((i) => i.key === key)

let g = await game()
check('정원 준비됨(033·034 적용)', g.garden?.ready === true)
check('놓은 장식 목록이 배열', Array.isArray(g.garden?.items))
const start = g.sunlight.balance
console.log('  시작 잔액', start, '가진 장식', g.garden.owned)

console.log('— 거부되는 요청')
check('로그인 없이 놓기 401', (await put('decor_tulip', 20, 30, anon)).status === 401)
check('안 가진 장식 놓기 403', g.garden.owned.includes('decor_fountain') || (await put('decor_fountain', 40, 40)).status === 403)
check('캐릭터 아이템 놓기 400', (await put('hat_cap', 20, 30)).status === 400)
check('없는 장식 400', (await put('decor_nothing', 20, 30)).status === 400)
check('정원 밖(x 81) 400', (await put('decor_tulip', 81, 30)).status === 400)
check('정원 밖(y -1) 400', (await put('decor_tulip', 20, -1)).status === 400)
check('그림이 밖으로 나가는 자리(x 2) 400', (await put('decor_tulip', 2, 30)).status === 400)
check('그림이 밖으로 나가는 자리(y 5) 400', (await put('decor_tulip', 20, 5)).status === 400)
check('정수가 아닌 좌표 400', (await put('decor_tulip', 20.5, 30)).status === 400)
check('좌표가 글자 400', (await put('decor_tulip', '20', 30)).status === 400)
check('좌표 없음 400', (await me('/api/me/game/garden', { method: 'PUT', body: { item: 'decor_tulip' } })).status === 400)
check('장식 값 없음 400', (await me('/api/me/game/garden', { method: 'PUT', body: { x: 20, y: 30 } })).status === 400)
check('없는 장식 구매 400', (await buy('decor_nothing')).status === 400)

console.log('— 구매')
if (!g.garden.owned.includes('decor_tulip')) {
  const b = await buy('decor_tulip')
  check('튤립 구매 200', b.status === 200, JSON.stringify(b).slice(0, 120))
  check('잔액 30 줄어듦', b.game?.sunlight.balance === start - 30)
  check('내역에 "튤립 구매"', b.game?.ledger.some((l) => l.label === '튤립 구매' && l.points === -30))
}
check('같은 장식 다시 구매 409', (await buy('decor_tulip')).status === 409)
if (!g.garden.owned.includes('decor_sunflower')) {
  const rs = await Promise.all(Array.from({ length: 5 }, () => buy('decor_sunflower')))
  check('동시 구매 5번 중 성공 1번', rs.filter((r) => r.status === 200).length === 1, rs.map((r) => r.status).join(','))
}
g = await game()
check('캐릭터 아이템 목록에는 장식이 안 섞임', !g.character.owned.some((k) => k.startsWith('decor_')))
check('쓴 햇빛 = 가격 합(70)', g.sunlight.spent === 70, String(g.sunlight.spent))
const rest = g.sunlight.balance
const tooDear = await buy('decor_fountain')
check(`잔액 ${rest}으로 분수(120) 구매 409`, rest >= 120 || (tooDear.status === 409 && tooDear.code === 'insufficient'), JSON.stringify(tooDear).slice(0, 100))

console.log('— 놓기·옮기기·빼기')
let r = await put('decor_tulip', 20, 30)
check('튤립 (20,30)에 놓기', r.status === 200 && at(r.game, 'decor_tulip')?.x === 20 && at(r.game, 'decor_tulip')?.y === 30)
r = await put('decor_tulip', 60, 70)
check('튤립 (60,70)으로 옮김 — 여전히 1개', at(r.game, 'decor_tulip')?.x === 60 && r.game.garden.items.filter((i) => i.key === 'decor_tulip').length === 1)
r = await put('decor_sunflower', 60, 70)
check('해바라기를 같은 자리에 놓아도 됨(겹침 허용)', r.status === 200 && at(r.game, 'decor_sunflower')?.x === 60 && at(r.game, 'decor_tulip')?.x === 60)
r = await put('decor_sunflower', 8, 16)
check('맨 왼쪽 위 끝(8,16) 가능', r.status === 200 && at(r.game, 'decor_sunflower')?.y === 16)
r = await put('decor_sunflower', 72, 80)
check('맨 오른쪽 아래 끝(72,80) 가능', r.status === 200 && at(r.game, 'decor_sunflower')?.x === 72)
r = await takeOut('decor_sunflower')
check('해바라기 빼기 → 정원에 없음, 가진 채로', r.status === 200 && !at(r.game, 'decor_sunflower') && r.game.garden.owned.includes('decor_sunflower'))
check('이미 뺀 장식 다시 빼기도 오류 없음', (await takeOut('decor_sunflower')).status === 200)
r = await put('decor_sunflower', 40, 76)
check('빼 둔 해바라기 다시 놓기', at(r.game, 'decor_sunflower')?.y === 76)
const many = await Promise.all([[10, 20], [30, 40], [50, 60], [70, 80]].map(([x, y]) => put('decor_tulip', x, y)))
g = await game()
check('동시에 여러 자리로 옮겨도 튤립은 1개', many.every((x) => x.status === 200) && g.garden.items.filter((i) => i.key === 'decor_tulip').length === 1, JSON.stringify(g.garden.items))
check('잔액은 놓기·옮기기로 변하지 않음', g.sunlight.balance === rest)

console.log('— 남에게 영향 없음')
const other = emps.find((e) => e.id !== s.id)
const prof = await anon(`/api/game/profile?id=${other.id}`)
check('다른 직원 프로필 조회 정상', prof.status === 200)

console.log('— 정원 구경(공개를 켠 직원만)')
const setPublic = (v) => me('/api/me/game/profile', { method: 'PUT', body: { showInFeed: v } })
const wasPublic = (await game()).showInFeed
await setPublic(false)
let pv = (await anon(`/api/game/profile?id=${s.id}`)).profile
check('공개 끔 → 정원 안 나감', pv.garden === null && !JSON.stringify(pv).includes('decor_'))
await setPublic(true)
pv = (await anon(`/api/game/profile?id=${s.id}`)).profile
g = await game()
check('공개 켬 → 정원 나감', Array.isArray(pv.garden?.items))
check('동료에게 보이는 배치 = 내 배치', JSON.stringify(pv.garden?.items) === JSON.stringify(g.garden.items))
check('나무 단계 이름만(운동한 날 수 없음)', pv.garden?.stageName === g.tree.name && !('activeDays' in (pv.garden ?? {})))
check('햇빛·가진 장식 목록·내역은 안 나감', !/sunlight|balance|owned|ledger|activeDays/.test(JSON.stringify(pv)))
check('다른 직원(공개 끔)은 정원 없음', prof.profile?.showCharacter === true || prof.profile?.garden === null)
await setPublic(wasPublic)

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`)
process.exit(fail ? 1 : 0)
