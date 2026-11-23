import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { parseChallenge } from '@/lib/server/challenge-input'
import { fail, guardAdminWrite, handle, ok, readJson, requireAdmin, writeAudit } from '@/lib/server/guard'
import { challengeProgress, challengeStatus, ChallengeRow, dailyCredits, kstToday, loadLogs, readAllRows } from '@/lib/server/engagement'

export const dynamic = 'force-dynamic'

// 관리자: 챌린지 목록 + 참여 인원·달성 인원
export const GET = handle(async () => {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const db = serverDb()
  const today = kstToday()
  const [{ data: chs }, parts] = await Promise.all([
    db.from('challenges').select('*').order('start_date', { ascending: false }),
    readAllRows<{ challenge_id: string; employee_id: string }>(() => db.from('challenge_participants').select('challenge_id, employee_id'), ['challenge_id', 'employee_id']),
  ])
  const list = (chs ?? []) as ChallengeRow[]
  const minStart = list.reduce((m, c) => (c.start_date < m ? c.start_date : m), today)
  const credits = list.length ? dailyCredits(await loadLogs(db, { from: minStart })) : []
  return ok({
    challenges: list.map((c) => {
      const ps = parts.filter((p) => p.challenge_id === c.id)
      const achieved = ps.filter((p) => challengeProgress(c, credits.filter((x) => x.employeeId === p.employee_id), today) >= c.target).length
      return { ...c, status: challengeStatus(c, today), participants: ps.length, achieved }
    }),
  })
})

export const POST = handle(async (req: NextRequest) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  const p = parseChallenge(await readJson<Record<string, unknown>>(req))
  if ('error' in p) return fail(400, p.error as string)
  const { data, error } = await serverDb().from('challenges').insert(p.value).select('*').single()
  if (error) throw new Error('CHALLENGE_CREATE_FAILED')
  await writeAudit({ table: 'challenges', recordId: data.id, action: 'insert', actorType: 'admin', after: data })
  return ok({ challenge: data })
})
