import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { cleanText } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, requireAdmin, writeAudit } from '@/lib/server/guard'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// 관리자용 직원 목록 + PIN 상태 (PIN 해시는 절대 내보내지 않음)
export const GET = handle(async () => {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const db = serverDb()
  const [{ data: emps }, { data: pins }] = await Promise.all([
    db.from('employees').select('*').order('name'),
    db.from('employee_pins').select('employee_id, is_temp, locked_until'),
  ])
  const pinMap = new Map((pins ?? []).map((p) => [p.employee_id, p]))
  const list = (emps ?? []).map((e) => {
    const p = pinMap.get(e.id)
    const locked = !!p?.locked_until && new Date(p.locked_until).getTime() > Date.now()
    return { ...e, pin_status: !p ? 'none' : locked ? 'locked' : p.is_temp ? 'temp' : 'set' }
  })
  return ok({ employees: list })
})

export const POST = handle(async (req: NextRequest) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  const body = await readJson<{ name?: string; employeeNumber?: string }>(req)
  const name = cleanText(body?.name, 30)
  const employeeNumber = cleanText(body?.employeeNumber, 20)
  if (!name) return fail(400, '이름을 입력해주세요.')
  if (!employeeNumber) return fail(400, '사번을 입력해주세요.')

  const { data, error } = await serverDb().from('employees').insert({ name, employee_number: employeeNumber }).select('*').single()
  if (error) return fail(400, error.code === '23505' ? '이미 등록된 사번이에요.' : '등록에 실패했어요.')
  await writeAudit({ table: 'employees', recordId: data.id, action: 'insert', actorType: 'admin', after: data })
  return ok({ employee: data })
})
