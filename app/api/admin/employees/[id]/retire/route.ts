import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { isValidDate, UUID_RE } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, writeAudit } from '@/lib/server/guard'
import { revokeEmployeeSessions } from '@/lib/server/session'
import { addDays } from '@/lib/server/engagement'

export const dynamic = 'force-dynamic'

// 관리자: 퇴사 처리(직원 삭제 대신). 기록·응원·부서 이력은 그대로 남깁니다.
// leftAt = 마지막 근무일. 다음 날부터 로그인 불가, 로그인 중인 기기는 바로 로그아웃.
// leftAt 이 null 이면 퇴사 처리 취소(재직으로 되돌림, 부서는 다시 배정해야 함).
export const POST = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')
  const body = await readJson<{ leftAt?: string | null }>(req)
  const leftAt = body?.leftAt ?? null
  if (leftAt !== null && !isValidDate(leftAt)) return fail(400, '퇴사일을 다시 골라주세요.')

  const db = serverDb()
  const { data: before } = await db.from('employees').select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail(404, '직원을 찾을 수 없어요.')
  const { data, error } = await db.from('employees').update({ left_at: leftAt }).eq('id', params.id).select('*').single()
  if (error) throw new Error('RETIRE_FAILED')

  if (leftAt) {
    // 현재 부서 배정을 퇴사 다음 날로 끝냄(이력 보존)
    const { data: open } = await db.from('employee_departments').select('id, start_date').eq('employee_id', params.id).is('end_date', null).maybeSingle()
    if (open) {
      const end = addDays(leftAt, 1)
      await db.from('employee_departments').update({ end_date: end > open.start_date ? end : addDays(open.start_date, 1) }).eq('id', open.id)
    }
    await revokeEmployeeSessions(params.id)
  }
  await writeAudit({ table: 'employees', recordId: params.id, action: 'update', actorType: 'admin', before, after: data })
  return ok({ employee: data })
})
