// 응원 중복 방지 시험 — ⚠️ 시험 DB에 연결된 로컬 서버에서만 (운영 주소면 실행 거부)
//
// 사용법: node scripts/cheer-test.mjs http://localhost:3574 .env.local
//
// 시험용 운동 기록 2개를 만들어 응원을 누르고, 끝나면 지웁니다(응원도 함께 지워짐).
// 다른 기록에 달린 기존 응원은 시작 전후로 똑같은지 대조합니다.
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './backup.mjs'

const [base, envFile] = process.argv.slice(2)
if (!base?.startsWith('http://localhost') || !envFile) {
  console.error('사용법: node scripts/cheer-test.mjs http://localhost:<포트> <시험 env 파일>')
  process.exit(1)
}
const env = loadEnv(envFile)
if (env.NEXT_PUBLIC_SUPABASE_URL.includes('xambccrcircnlbnuhfcw')) {
  console.error('운영 DB 주소입니다. 이 시험은 시험 DB에서만 실행합니다.')
  process.exit(1)
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

let pass = 0, total = 0
const check = (name, ok, detail = '') => {
  total++
  if (ok) pass++
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}
async function post(path, body) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'x-sgrh-request': '1', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, ...(await res.json().catch(() => ({}))) }
}
const cheer = (logId, deviceId, emoji, on) => post('/api/reactions', on === undefined ? { logId, deviceId, emoji } : { logId, deviceId, emoji, on })
const rows = async (logId, emoji, deviceId) => {
  let q = db.from('log_reactions').select('id', { count: 'exact', head: true }).eq('log_id', logId)
  if (emoji) q = q.eq('emoji', emoji)
  if (deviceId) q = q.eq('device_id', deviceId)
  return (await q).count
}
async function fingerprint(excludeIds) {
  const all = []
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('log_reactions').select('id, log_id, device_id, emoji, created_at').order('id').range(from, from + 999)
    all.push(...data)
    if (data.length < 1000) break
  }
  const kept = all.filter((r) => !excludeIds.includes(r.log_id))
  return { n: kept.length, key: kept.map((r) => `${r.id}|${r.log_id}|${r.device_id}|${r.emoji}|${r.created_at}`).join('\n') }
}

const A = 'cheer-test-device-a'
const B = 'cheer-test-device-b'

// 준비: 시험 기록 2개
const { data: emp } = await db.from('employees').select('id').limit(1).single()
const { data: type } = await db.from('exercise_types').select('id').limit(1).single()
const { data: made, error: mkErr } = await db
  .from('exercise_logs')
  .insert([1, 2].map(() => ({ employee_id: emp.id, exercise_type_id: type.id, log_date: '2026-11-01', duration_seconds: 600, memo: '응원시험' })))
  .select('id')
if (mkErr) throw new Error(mkErr.message)
const [L1, L2] = made.map((x) => x.id)
// 기존 응원 흉내: 다른 기록 5개에 응원 10건 (시험 DB에 응원이 없을 때를 대비, 끝나면 지움)
const { data: others } = await db.from('exercise_logs').select('id').neq('memo', '응원시험').limit(5)
const SEED = 'cheer-seed-device'
const seedRows = others.flatMap((o, i) => [
  { log_id: o.id, device_id: `${SEED}-1`, emoji: '👏' },
  { log_id: o.id, device_id: `${SEED}-${i + 2}`, emoji: i % 2 ? '🔥' : '💪' },
])
await db.from('log_reactions').upsert(seedRows, { onConflict: 'log_id,device_id,emoji', ignoreDuplicates: true })
const before = await fingerprint([L1, L2])
const seedSum = await post('/api/reactions/summary', { logIds: others.map((o) => o.id), deviceId: `${SEED}-1` })
check(
  '기존 응원이 새 요약 API로 그대로 보임',
  seedSum.cheers.reduce((a, c) => a + c.count, 0) >= seedRows.length &&
    seedSum.cheers.filter((c) => c.emoji === '👏' && c.mine).length === others.length
)
console.log(`준비: 시험 기록 2개 · 다른 기록의 기존 응원 ${before.n}건\n`)

try {
  // 1) 같은 이모지 연속 클릭(켜기 2번) → 1개
  await cheer(L1, A, '👏', true)
  const r2 = await cheer(L1, A, '👏', true)
  check('같은 이모지 연속 켜기 2번 → 1개', (await rows(L1, '👏', A)) === 1 && r2.count === 1, `응답 count ${r2.count}`)

  // 2) 빠른 연타: 같은 요청 20개 동시 → DB 1행
  await Promise.all(Array.from({ length: 20 }, () => cheer(L1, A, '🔥', true)))
  check('켜기 20번 동시 요청 → DB 1행', (await rows(L1, '🔥', A)) === 1)

  // 3) 이전 화면 방식(뒤집기) 동시 10개 → 중복 행 없음
  await Promise.all(Array.from({ length: 10 }, () => cheer(L2, A, '💪')))
  const legacy = await rows(L2, '💪', A)
  check('이전 방식(뒤집기) 동시 10번 → 중복 없음', legacy <= 1, `DB ${legacy}행`)
  await cheer(L2, A, '💪', false)

  // 4) 켜기·끄기 섞어 30개 동시 → 0 또는 1행, 요약 숫자 = DB 행 수
  await Promise.all(Array.from({ length: 30 }, (_, i) => cheer(L2, A, '👏', i % 3 !== 0)))
  const mixed = await rows(L2, '👏', A)
  const sumMixed = await post('/api/reactions/summary', { logIds: [L2], deviceId: A })
  const mixedCount = sumMixed.cheers.find((c) => c.emoji === '👏')?.count ?? 0
  check('켜기·끄기 섞어 30번 동시 → 0~1행, 화면 숫자와 DB 일치', mixed <= 1 && mixedCount === mixed, `DB ${mixed}행 · 요약 ${mixedCount}`)
  await cheer(L2, A, '👏', false)

  // 5) 취소 후 재선택
  const off = await cheer(L1, A, '👏', false)
  const offAgain = await cheer(L1, A, '👏', false)
  const onAgain = await cheer(L1, A, '👏', true)
  check('응원 취소 → 0개, 한 번 더 취소해도 0개', off.on === false && off.count === 0 && offAgain.count === 0)
  check('취소 후 다시 선택 → 1개', onAgain.on === true && onAgain.count === 1 && (await rows(L1, '👏', A)) === 1)

  // 6) 다른 이모지는 각각 선택 가능
  await cheer(L1, A, '💪', true)
  check('다른 이모지 각각 선택(👏·💪·🔥 모두 켜짐)', (await rows(L1, null, A)) === 3)

  // 7) 다른 운동 기록에 응원 → 서로 영향 없음
  await cheer(L2, A, '👏', true)
  check('다른 기록 응원은 따로 집계', (await rows(L2, '👏', A)) === 1 && (await rows(L1, '👏', A)) === 1)

  // 8) 다른 기기에서 응원 → 따로 1개씩, 다른 기기가 꺼도 내 응원은 그대로
  const b1 = await cheer(L1, B, '👏', true)
  check('다른 기기 응원 → 2개', b1.count === 2)
  await cheer(L1, B, '👏', false)
  check('다른 기기가 꺼도 내 응원은 유지', (await rows(L1, '👏', A)) === 1 && (await rows(L1, '👏', B)) === 0)

  // 9) 새로고침 = 요약 다시 받기 → 내가 누른 것만 표시, 기기 식별값은 안 내려옴
  const sa = await post('/api/reactions/summary', { logIds: [L1, L2], deviceId: A })
  const sb = await post('/api/reactions/summary', { logIds: [L1, L2], deviceId: B })
  const mineA = sa.cheers.filter((c) => c.mine).length
  const mineB = sb.cheers.filter((c) => c.mine).length
  check('새로고침 뒤 내 선택 상태 유지 (A 4개 켜짐, B 0개)', mineA === 4 && mineB === 0, `A ${mineA} · B ${mineB}`)
  check('요약 응답에 기기 식별값 없음', !JSON.stringify(sa).includes(A) && !JSON.stringify(sa).includes('device'))

  // 10) 공개 키로 응원 행 직접 읽기 → 022 이후 0행 (기기 식별값 노출 차단)
  const { data: pub, error: pubErr } = await anon.from('log_reactions').select('device_id').eq('log_id', L1)
  check('공개 키로 기기 식별값 읽기 차단 (022)', !pubErr && (pub ?? []).length === 0, pubErr?.message ?? `${(pub ?? []).length}행 보임`)
  const { error: insErr } = await anon.from('log_reactions').insert({ log_id: L1, device_id: 'cheer-direct-x', emoji: '👏' })
  check('공개 키로 직접 응원 넣기 차단 (019)', !!insErr, insErr?.code)

  // 11) 잘못된 요청
  check('on 값이 참/거짓이 아니면 거부', (await post('/api/reactions', { logId: L1, deviceId: A, emoji: '👏', on: 'yes' })).status === 400)
  check('기기 식별값 형식이 틀리면 거부', (await cheer(L1, 'x', '👏', true)).status === 400)
  check('허용되지 않은 이모지 거부', (await cheer(L1, A, '💩', true)).status === 400)
  check('요약 요청 기록 101개 이상 거부', (await post('/api/reactions/summary', { logIds: Array(101).fill(L1), deviceId: A })).status === 400)
  check('전용 헤더 없는 요청 거부(CSRF)', (await fetch(base + '/api/reactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logId: L1, deviceId: A, emoji: '👏', on: true }) })).status === 403)
} finally {
  await db.from('exercise_logs').delete().in('id', [L1, L2])
}

// 12) 기존 응원 데이터 그대로
const after = await fingerprint([L1, L2])
check('기존 응원 데이터 유지 (다른 기록의 응원 행 전후 동일)', after.n === before.n && after.key === before.key, `${before.n}건 → ${after.n}건`)
await db.from('log_reactions').delete().like('device_id', `${SEED}%`)
check('시험 기록·응원 정리', (await rows(L1)) === 0 && (await rows(L2)) === 0)

console.log(`\n결과: ${pass}/${total} 통과`)
process.exit(pass === total ? 0 : 2)
