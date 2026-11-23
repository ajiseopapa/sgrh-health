import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { isValidDate, UUID_RE } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, writeAudit } from '@/lib/server/guard'
import { kstToday } from '@/lib/server/engagement'

export const dynamic = 'force-dynamic'

// 관리자: 직원 부서 배정·이동. 기존 배정은 지우지 않고 끝날짜를 넣어 이력으로 남깁니다.
// departmentId 가 null 이면 현재 배정만 끝냄(미배정).
export const POST = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')
  const body = await readJson<{ departmentId?: string | null; startDate?: string }>(req)
  const departmentId = body?.departmentId ?? null
  if (departmentId !== null && !UUID_RE.test(departmentId)) return fail(400, '부서를 다시 골라주세요.')
  const startDate = body?.startDate ?? kstToday()
  if (!isValidDate(startDate)) return fail(400, '적용 날짜를 다시 골라주세요.')

  const db = serverDb()
  const { data: emp } = await db.from('employees').select('id').eq('id', params.id).maybeSingle()
  if (!emp) return fail(404, '직원을 찾을 수 없어요.')
  if (departmentId) {
    const { data: d } = await db.from('departments').select('id').eq('id', departmentId).maybeSingle()
    if (!d) return fail(404, '부서를 찾을 수 없어요.')
  }
  const { data: open } = await db.from('employee_departments').select('*').eq('employee_id', params.id).is('end_date', null).maybeSingle()
  if (open && open.department_id === departmentId) return ok({ unchanged: true })
  if (open && startDate <= open.start_date) return fail(400, `현재 부서 시작일(${open.start_date})보다 뒤 날짜로 정해주세요.`)

  if (open) {
    const { error } = await db.from('employee_departments').update({ end_date: startDate }).eq('id', open.id)
    if (error) throw new Error('DEPT_CLOSE_FAILED')
  }
  let created = null
  if (departmentId) {
    const { data, error } = await db
      .from('employee_departments')
      .insert({ employee_id: params.id, department_id: departmentId, start_date: startDate })
      .select('*')
      .single()
    if (error) throw new Error('DEPT_ASSIGN_FAILED')
    created = data
  }
  await writeAudit({ table: 'employee_departments', recordId: params.id, action: 'update', actorType: 'admin', before: open, after: created })
  return ok({ assignment: created })
})
