import { serverDb } from '@/lib/server/db'
import { handle, ok } from '@/lib/server/guard'
import { addDays, challengeStatus, ChallengeRow, kstToday } from '@/lib/server/engagement'

export const dynamic = 'force-dynamic'

// 공개: 진행 중·예정·최근 끝난 챌린지와 참여 인원 수 (누가 참여했는지는 내보내지 않음)
// 내 진행률은 로그인 후 /api/me/engagement 에서 받습니다.
export const GET = handle(async () => {
  const db = serverDb()
  const today = kstToday()
  const [{ data: chs }, { data: parts }] = await Promise.all([
    db.from('challenges').select('id, title, description, metric, target, start_date, end_date').gte('end_date', addDays(today, -30)).order('start_date'),
    db.from('challenge_participants').select('challenge_id'),
  ])
  const count = new Map<string, number>()
  for (const p of parts ?? []) count.set(p.challenge_id, (count.get(p.challenge_id) ?? 0) + 1)
  return ok({
    today,
    challenges: ((chs ?? []) as ChallengeRow[]).map((c) => ({ ...c, status: challengeStatus(c, today), participants: count.get(c.id) ?? 0 })),
  })
})
