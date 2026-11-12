import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { handle, ok, requireEmployee } from '@/lib/server/guard'
import { challengeProgress, challengeStatus, ChallengeRow, employeeOverview } from '@/lib/server/engagement'

export const dynamic = 'force-dynamic'

// 도전 화면용 내 현황: 이번 주 기록·목표·연속·배지·내가 볼 수 있는 챌린지 진행률
// 본인 세션의 직원 ID만 씁니다(다른 직원 ID를 받지 않음).
export const GET = handle(async () => {
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  const db = serverDb()
  const o = await employeeOverview(db, auth.employeeId)

  const [{ data: chs }, { data: mine }, { data: counts }] = await Promise.all([
    db.from('challenges').select('id, title, description, metric, target, start_date, end_date').gte('end_date', addDaysSafe(o.today, -30)).order('start_date'),
    db.from('challenge_participants').select('challenge_id, joined_at').eq('employee_id', auth.employeeId),
    db.from('challenge_participants').select('challenge_id'),
  ])
  const joined = new Map((mine ?? []).map((m) => [m.challenge_id, m.joined_at]))
  const countMap = new Map<string, number>()
  for (const c of counts ?? []) countMap.set(c.challenge_id, (countMap.get(c.challenge_id) ?? 0) + 1)
  const challenges = ((chs ?? []) as ChallengeRow[]).map((c) => ({
    ...c,
    status: challengeStatus(c, o.today),
    participants: countMap.get(c.id) ?? 0,
    joined: joined.has(c.id),
    progress: joined.has(c.id) ? challengeProgress(c, o.credits, o.today) : null,
  }))

  const { credits: _omit, ...rest } = o
  void _omit
  return ok({ ...rest, challenges })
})

function addDaysSafe(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
