// 백업 폴더를 DB에 되살리는 도구
//
// 사용법:
//   node scripts/restore.mjs <env 파일> <백업 폴더> --confirm <대상 주소 호스트>
//   예) node scripts/restore.mjs .env.test.local E:/claude/sgrh-health-backups/20261110T2100 --confirm abcd.supabase.co
//
// 동작: 대상 DB의 해당 테이블 내용을 지우고, 백업 내용을 그대로 다시 넣은 뒤 행 수·체크섬을 대조합니다.
// ⚠️ 대상 DB의 지금 데이터가 사라집니다. --confirm 에 대상 호스트를 정확히 적어야만 실행됩니다.
//    운영 DB 복원은 PM 승인 후, 반드시 먼저 backup.mjs로 지금 상태를 한 번 더 받아둔 다음에만 합니다.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { dbFromEnv, readAll, checksum } from './backup.mjs'

// 외래키 순서 (넣을 때는 이 순서, 지울 때는 반대)
const ORDER = [
  'employees',
  'exercise_types',
  'departments', // v2.1
  'department_headcounts', // v2.1
  'employee_departments', // v2.1
  'exercise_logs',
  'log_reactions',
  'announcements',
  'suggestions',
  'employee_goals',
  'employee_pins',
  'personal_goals', // v2.1
  'challenges', // v2.1
  'challenge_participants', // v2.1
  'employee_badges', // v2.1
  'audit_logs',
]
// 로그인 세션은 복원하지 않습니다(복원 후 모두 다시 로그인)

const KEY = { employee_pins: 'employee_id', department_headcounts: 'department_id', challenge_participants: 'challenge_id', employee_badges: 'employee_id' }

async function main() {
  const args = process.argv.slice(2)
  const [envFile, dir] = args
  const confirm = args[args.indexOf('--confirm') + 1]
  if (!envFile || !dir || !existsSync(join(dir, 'manifest.json')) || args.indexOf('--confirm') < 0) {
    console.error('사용법: node scripts/restore.mjs <env 파일> <백업 폴더> --confirm <대상 호스트>')
    process.exit(1)
  }
  const { url, db } = dbFromEnv(envFile)
  const host = new URL(url).host
  if (confirm !== host) {
    console.error(`대상 호스트가 다릅니다. 지금 대상: ${host}`)
    process.exit(1)
  }
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  const tables = ORDER.filter((t) => manifest.tables[t])

  console.log(`대상: ${host} / 백업 원본: ${manifest.source} (${manifest.created_at})`)

  // 1) 지우기 (자식 → 부모)
  await db.from('auth_sessions').delete().not('id', 'is', null)
  for (const t of [...tables].reverse()) {
    const key = KEY[t] ?? 'id'
    const { error } = await db.from(t).delete().not(key, 'is', null)
    if (error) throw new Error(`${t} 비우기 실패: ${error.message}`)
  }

  // 2) 넣기 (부모 → 자식), 500건씩
  for (const t of tables) {
    const rows = JSON.parse(readFileSync(join(dir, `${t}.json`), 'utf8'))
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from(t).insert(rows.slice(i, i + 500))
      if (error) throw new Error(`${t} 넣기 실패(${i}번째부터): ${error.message}`)
    }
  }

  // 3) 대조
  let allOk = true
  for (const t of tables) {
    const rows = await readAll(db, t)
    const want = manifest.tables[t]
    const okRows = rows.length === want.rows
    const okSum = checksum(rows) === want.checksum
    if (!okRows || !okSum) allOk = false
    console.log(`- ${t}: ${rows.length}/${want.rows}건 ${okRows && okSum ? '✅ 일치' : '❌ 불일치'}`)
  }
  console.log(allOk ? '\n복원 완료: 전부 일치' : '\n⚠️ 불일치가 있습니다. 위 목록을 확인하세요.')
  process.exit(allOk ? 0 : 2)
}

main().catch((e) => { console.error('복원 실패:', e.message); process.exit(1) })
