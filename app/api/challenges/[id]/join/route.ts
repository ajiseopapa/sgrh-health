import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, limitWrites, ok, requireEmployee, writeAudit } from '@/lib/server/guard'
import { UUID_RE } from '@/lib/server/validate'
import { challengeStatus, ChallengeRow, kstToday } from '@/lib/server/engagement'

export const dynamic = 'force-dynamic'

// 챌린지 참여 — 본인만. 진행 중이거나 시작 전인 챌린지만. 이미 참여했으면 그대로(중복 없음)
export const POST = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')

  const db = serverDb()
  const { data: c } = await db.from('challenges').select('*').eq('id', params.id).maybeSingle()
  if (!c) return fail(404, '챌린지를 찾을 수 없어요.')
  if (challengeStatus(c as ChallengeRow, kstToday()) === 'ended') return fail(400, '이미 끝난 챌린지예요.')

  const { data, error } = await db
    .from('challenge_participants')
    .upsert({ challenge_id: params.id, employee_id: auth.employeeId }, { onConflict: 'challenge_id,employee_id', ignoreDuplicates: true })
    .select('joined_at')
  if (error) throw new Error('JOIN_FAILED')
  if (data && data.length > 0) {
    await writeAudit({ table: 'challenge_participants', recordId: params.id, action: 'insert', actorType: 'employee', actorEmployeeId: auth.employeeId })
  }
  return ok({ joined: true })
})
