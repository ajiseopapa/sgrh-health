import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { UUID_RE } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, writeAudit } from '@/lib/server/guard'
import { addDays, kstToday } from '@/lib/server/engagement'
import { parseChallenge } from '@/lib/server/challenge-input'

export const dynamic = 'force-dynamic'

// 관리자: 챌린지 수정 또는 바로 끝내기(endNow → 종료일을 어제로, 오늘 시작한 챌린지는 오늘로)
// 참여자가 있는 챌린지는 기준·목표·시작일을 바꾸지 않음(진행 중 규칙 변경 방지). 이름·설명·종료일만.
export const PATCH = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')
  const body = await readJson<Record<string, unknown>>(req)
  const db = serverDb()
  const { data: before } = await db.from('challenges').select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail(404, '챌린지를 찾을 수 없어요.')

  let patch: Record<string, unknown>
  if (body?.endNow === true) {
    const today = kstToday()
    const end = addDays(today, -1) >= before.start_date ? addDays(today, -1) : before.start_date
    patch = { end_date: end }
  } else {
    const p = parseChallenge(body)
    if ('error' in p) return fail(400, p.error as string)
    const { count } = await db.from('challenge_participants').select('employee_id', { count: 'exact', head: true }).eq('challenge_id', params.id)
    const v = p.value
    if ((count ?? 0) > 0 && (v.metric !== before.metric || v.target !== before.target || v.start_date !== before.start_date)) {
      return fail(400, '참여자가 있는 챌린지는 기준·목표·시작일을 바꿀 수 없어요.')
    }
    patch = v
  }
  const { data, error } = await db.from('challenges').update(patch).eq('id', params.id).select('*').single()
  if (error) throw new Error('CHALLENGE_UPDATE_FAILED')
  await writeAudit({ table: 'challenges', recordId: params.id, action: 'update', actorType: 'admin', before, after: data })
  return ok({ challenge: data })
})
