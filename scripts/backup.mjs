// 핵심 테이블을 JSON + CSV로 내려받는 백업 도구 (읽기만 함, DB를 바꾸지 않음)
//
// 사용법:
//   node scripts/backup.mjs <env 파일> [저장 폴더]
//   예) node scripts/backup.mjs .env.test.local
//
// - env 파일에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 있어야 합니다.
// - 저장 폴더 기본값: E:\claude\sgrh-health-backups\<날짜시각>\  (저장소 밖 → GitHub에 올라가지 않음)
// - ⚠️ 직원 이름·사번·운동 기록이 들어 있는 개인정보 파일입니다. 폴더 공유·메일 첨부 금지.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const TABLES = [
  'employees',
  'exercise_types',
  'exercise_logs',
  'log_reactions',
  'announcements',
  'suggestions',
  'employee_goals',
  'employee_pins',
  'auth_sessions',
  'audit_logs',
  'races', // 앱은 안 쓰는 옛 대회 테이블. 023(접근 차단) 전후 보존 확인용. 없으면 건너뜀
]

export function loadEnv(file) {
  const env = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

export function dbFromEnv(file) {
  const env = loadEnv(file)
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`${file}에 NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없어요`)
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    db: createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  }
}

/** 1,000건 제한을 넘도록 나눠서 전부 읽습니다. 테이블이 없으면 null. */
export async function readAll(db, table) {
  const rows = []
  const page = 1000
  const key = table === 'employee_pins' ? 'employee_id' : 'id'
  for (let from = 0; ; from += page) {
    const { data, error } = await db.from(table).select('*').order(key, { ascending: true }).range(from, from + page - 1)
    if (error) {
      // 테이블 자체가 없는 경우(아직 마이그레이션 전)
      if (error.code === '42P01' || error.code === 'PGRST205' || /Could not find the table/.test(error.message)) return null
      throw new Error(`${table}: ${error.message}`)
    }
    rows.push(...data)
    if (data.length < page) return rows
  }
}

function toCsv(rows) {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const esc = (v) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '\uFEFF' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n')
}

export function checksum(rows) {
  const sorted = [...rows].map((r) => JSON.stringify(r, Object.keys(r).sort())).sort()
  return createHash('sha256').update(sorted.join('\n')).digest('hex').slice(0, 16)
}

async function main() {
  const [envFile, outArg] = process.argv.slice(2)
  if (!envFile || !existsSync(envFile)) {
    console.error('사용법: node scripts/backup.mjs <env 파일> [저장 폴더]')
    process.exit(1)
  }
  const { url, db } = dbFromEnv(envFile)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
  const out = resolve(outArg ?? join('E:/claude/sgrh-health-backups', stamp))
  mkdirSync(out, { recursive: true })

  const manifest = { created_at: new Date().toISOString(), source: new URL(url).host, tables: {} }
  for (const t of TABLES) {
    const rows = await readAll(db, t)
    if (rows === null) { console.log(`- ${t}: 테이블 없음(건너뜀)`); continue }
    writeFileSync(join(out, `${t}.json`), JSON.stringify(rows, null, 1))
    writeFileSync(join(out, `${t}.csv`), toCsv(rows))
    manifest.tables[t] = { rows: rows.length, checksum: checksum(rows) }
    console.log(`- ${t}: ${rows.length}건`)
  }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\n백업 완료: ${out}`)
  console.log('⚠️ 개인정보가 들어 있으니 이 폴더는 공유하지 마세요.')
}

// 직접 실행했을 때만 백업 (restore.mjs 등에서 불러올 때는 실행 안 함)
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/backup.mjs')) {
  main().catch((e) => { console.error('백업 실패:', e.message); process.exit(1) })
}
