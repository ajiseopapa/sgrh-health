// 집계형 달력 시험 — ⚠️ 시험 DB 전용 (운영 주소면 실행 거부)
//
// 사용법: node scripts/calendar-test.mjs <시험 env 파일> <직원 수> [<직원 수> ...]
//   예) node scripts/calendar-test.mjs .env.local 10 50 100 300
//
// 직원 수마다:
//  1) 이전 시험 직원(사번 C로 시작)과 그 기록을 지우고, N명을 새로 만듭니다 (등록일 2026-10-01 → 11월 재직 인원에 포함)
//  2) 이번 달 1일~오늘 기록을 만듭니다
//     - 날짜마다 참여율을 다르게(0%·10%·30%·60%·90%), 7일마다 하루는 기록 없는 날
//     - 참여자 중 일부는 같은 날 2~3번 기록 (참여 인원은 1명으로 세야 함)
//     - 지난달(10월)에도 기록을 조금 → 10월 1일 기준 등록 직원 0명이면 "재직 인원 없음" 확인용
//     - 9월에도 기록 → 그 달 1일 기준 등록 직원 0명이라 "재직 인원 없음"(색 농도 없이 숫자만) 확인용
//  3) 달력 집계 함수 결과를 실제 기록 전체(1,000건 제한 없이 나눠 읽기)와 날짜별로 대조
//  4) 기록 수정·삭제 뒤 집계가 바로 바뀌는지 확인
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './backup.mjs'

const [envFile, ...sizes] = process.argv.slice(2)
if (!envFile || sizes.length === 0) {
  console.error('사용법: node scripts/calendar-test.mjs <시험 env 파일> <직원 수> ...')
  process.exit(1)
}
const env = loadEnv(envFile)
if (env.NEXT_PUBLIC_SUPABASE_URL.includes('xambccrcircnlbnuhfcw')) {
  console.error('운영 DB 주소입니다. 이 시험은 시험 DB에서만 실행합니다.')
  process.exit(1)
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
const [Y, M, D] = today.split('-').map(Number)
const pad = (n) => String(n).padStart(2, '0')
const monthKey = `${Y}-${pad(M)}-01`
const prevMonth = M === 1 ? `${Y - 1}-12` : `${Y}-${pad(M - 1)}`
// 시험 직원 등록일(10월 1일)보다 앞선 달 = 재직 인원 정보 없음 확인용
const noStaffMonth = '2026-09'

let seed = 42
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)

async function insertBatches(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).insert(rows.slice(i, i + 500))
    if (error) throw new Error(`${table} 넣기 실패: ${error.message}`)
  }
}

async function readAllLogs(from, to) {
  const all = []
  for (let off = 0; ; off += 1000) {
    const { data, error } = await db
      .from('exercise_logs')
      .select('employee_id, log_date, duration_seconds, duration_minutes')
      .gte('log_date', from)
      .lt('log_date', to)
      .order('id')
      .range(off, off + 999)
    if (error) throw new Error(error.message)
    all.push(...data)
    if (data.length < 1000) return all
  }
}

function expected(logs) {
  const map = new Map()
  for (const l of logs) {
    const e = map.get(l.log_date) ?? { set: new Set(), n: 0, s: 0 }
    e.set.add(l.employee_id)
    e.n++
    e.s += l.duration_seconds ?? (l.duration_minutes ? l.duration_minutes * 60 : 0)
    map.set(l.log_date, e)
  }
  return map
}

async function compareMonth(label, monthFirst, nextFirst, wantHeadcount) {
  const t0 = performance.now()
  const { data, error } = await anon.rpc('calendar_month_summary', { p_month: monthFirst })
  const ms = Math.round(performance.now() - t0)
  if (error) throw new Error(`집계 함수 오류: ${error.message}`)
  const logs = await readAllLogs(monthFirst, nextFirst)
  const exp = expected(logs)
  let mismatch = 0
  for (const d of data.days) {
    const e = exp.get(d.d)
    if (!e || e.set.size !== d.p || e.n !== d.n || e.s !== Number(d.s)) mismatch++
  }
  if (exp.size !== data.days.length) mismatch += Math.abs(exp.size - data.days.length)
  const hcOk = data.headcount === wantHeadcount
  const multi = logs.length - [...exp.values()].reduce((a, e) => a + e.set.size, 0)
  console.log(
    `  ${label}: 기록 ${logs.length}건 · 기록 있는 날 ${data.days.length}일 · 같은 날 중복 기록 ${multi}건 → ` +
      `날짜별 대조 ${mismatch === 0 ? '✅ 전부 일치' : `❌ ${mismatch}일 불일치`} · ` +
      `재직 인원 ${data.headcount ?? '없음'} ${hcOk ? '✅' : `❌(기대 ${wantHeadcount ?? '없음'})`} · 응답 ${ms}ms`
  )
  return { ok: mismatch === 0 && hcOk, data }
}

let allOk = true
for (const sizeArg of sizes) {
  const N = Number(sizeArg)
  console.log(`\n── 직원 ${N}명 ──`)

  // 1) 정리 후 생성
  const { data: old } = await db.from('employees').select('id').like('employee_number', 'C%')
  if (old?.length) {
    for (let i = 0; i < old.length; i += 200) {
      await db.from('employees').delete().in('id', old.slice(i, i + 200).map((e) => e.id))
    }
  }
  // 기존 T001~T005 시험 직원은 등록일이 오늘이라 이번 달 재직 인원에서 빠짐 → 기대 재직 인원 = N
  const emps = Array.from({ length: N }, (_, i) => ({
    name: `달력시험${String(i + 1).padStart(3, '0')}`,
    employee_number: `C${String(i + 1).padStart(4, '0')}`,
    created_at: '2026-10-01T00:00:00+09:00',
  }))
  await insertBatches('employees', emps)
  const { data: created } = await db.from('employees').select('id').like('employee_number', 'C%')
  const ids = created.map((e) => e.id)
  const { data: types } = await db.from('exercise_types').select('id')

  // 2) 기록 만들기
  const rates = [0.1, 0.3, 0.6, 0.9]
  const logs = []
  for (let day = 1; day <= D; day++) {
    if (day % 7 === 0) continue // 기록 없는 날
    const rate = rates[day % rates.length]
    for (const id of ids) {
      if (rand() >= rate) continue
      const times = rand() < 0.15 ? 2 + Math.floor(rand() * 2) : 1 // 15%는 하루 2~3번
      for (let t = 0; t < times; t++) {
        logs.push({
          employee_id: id,
          exercise_type_id: types[Math.floor(rand() * types.length)].id,
          log_date: `${Y}-${pad(M)}-${pad(day)}`,
          duration_seconds: 600 + Math.floor(rand() * 60) * 60,
          memo: '달력시험',
        })
      }
    }
  }
  // 지난달 기록 + 직원 등록 전 달(9월) 기록 (재직 인원 없음 확인용)
  for (const id of ids.slice(0, Math.min(5, ids.length))) {
    logs.push({ employee_id: id, exercise_type_id: types[0].id, log_date: `${prevMonth}-15`, duration_seconds: 1800, memo: '달력시험' })
    logs.push({ employee_id: id, exercise_type_id: types[0].id, log_date: `${noStaffMonth}-20`, duration_seconds: 1200, memo: '달력시험' })
  }
  await insertBatches('exercise_logs', logs)

  // 3) 대조 — 이번 달은 재직 N명, 지난달은 10월 1일 이전 등록 직원이 0명 → 재직 인원 없음
  const nextFirst = M === 12 ? `${Y + 1}-01-01` : `${Y}-${pad(M + 1)}-01`
  const cur = await compareMonth('이번 달', monthKey, nextFirst, N)
  const prev = await compareMonth('지난달', `${prevMonth}-01`, monthKey, N) // 10월 1일 등록 → 10월 재직에 포함
  const none = await compareMonth('직원 등록 전 달(9월)', `${noStaffMonth}-01`, `${prevMonth}-01`, null)
  allOk = allOk && cur.ok && prev.ok && none.ok

  // 참여율 구간 분포
  const bucket = { '1~24%': 0, '25~49%': 0, '50~74%': 0, '75~100%': 0 }
  for (const d of cur.data.days) {
    const r = d.p / N
    bucket[r < 0.25 ? '1~24%' : r < 0.5 ? '25~49%' : r < 0.75 ? '50~74%' : '75~100%']++
  }
  console.log(`  색 구간 분포: ${Object.entries(bucket).map(([k, v]) => `${k} ${v}일`).join(' · ')}`)

  // 4) 수정·삭제 반영
  const day1 = `${Y}-${pad(M)}-01`
  const before = cur.data.days.find((d) => d.d === day1)
  const { data: one } = await db.from('exercise_logs').select('id, duration_seconds').eq('log_date', day1).eq('memo', '달력시험').limit(1).single()
  await db.from('exercise_logs').update({ duration_seconds: one.duration_seconds + 60 }).eq('id', one.id)
  const { data: afterUpd } = await anon.rpc('calendar_month_summary', { p_month: monthKey })
  const u = afterUpd.days.find((d) => d.d === day1)
  const updOk = Number(u.s) === Number(before.s) + 60 && u.n === before.n
  await db.from('exercise_logs').delete().eq('id', one.id)
  const { data: afterDel } = await anon.rpc('calendar_month_summary', { p_month: monthKey })
  const dl = afterDel.days.find((d) => d.d === day1)
  const delOk = (dl?.n ?? 0) === before.n - 1
  console.log(`  수정 반영 ${updOk ? '✅' : '❌'} · 삭제 반영 ${delOk ? '✅' : '❌'}`)
  allOk = allOk && updOk && delOk
}

console.log(`\n${allOk ? '✅ 전체 통과' : '❌ 실패 있음'}`)
process.exit(allOk ? 0 : 2)
