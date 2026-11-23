import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { cleanText, UUID_RE } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, writeAudit } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')

  const body = await readJson<{ name?: string; employeeNumber?: string; color?: string | null }>(req)
  const name = cleanText(body?.name, 30)
  const employeeNumber = cleanText(body?.employeeNumber, 20)
  const color = body?.color ?? null
  if (!name) return fail(400, '이름을 입력해주세요.')
  if (!employeeNumber) return fail(400, '사번을 입력해주세요.')
  if (color !== null && !COLOR_RE.test(color)) return fail(400, '색상 값이 올바르지 않아요.')

  const db = serverDb()
  const { data: before } = await db.from('employees').select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail(404, '직원을 찾을 수 없어요.')
  const { data, error } = await db
    .from('employees')
    .update({ name, employee_number: employeeNumber, color })
    .eq('id', params.id)
    .select('*')
    .single()
  if (error) return fail(400, error.code === '23505' ? '이미 등록된 사번이에요.' : '수정에 실패했어요.')
  await writeAudit({ table: 'employees', recordId: params.id, action: 'update', actorType: 'admin', before, after: data })
  return ok()
})

// 직원 삭제 — 기록도 함께 삭제됨(기존 동작). 퇴사 처리는 부서 단계에서 추가 예정.
export const DELETE = handle(async (req: NextRequest, { params }: Ctx) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')

  const db = serverDb()
  const { data: before } = await db.from('employees').select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail(404, '직원을 찾을 수 없어요.')
  const { count } = await db.from('exercise_logs').select('id', { count: 'exact', head: true }).eq('employee_id', params.id)
  const { error } = await db.from('employees').delete().eq('id', params.id)
  if (error) return fail(400, '삭제에 실패했어요.')
  await writeAudit({ table: 'employees', recordId: params.id, action: 'delete', actorType: 'admin', before: { ...before, deleted_log_count: count ?? 0 } })
  return ok()
})
