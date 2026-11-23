import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { cleanText } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, requireAdmin, writeAudit } from '@/lib/server/guard'
import { readAllRows } from '@/lib/server/engagement'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// 관리자용 직원 목록 + PIN 상태 (PIN 해시는 절대 내보내지 않음)
export const GET = handle(async () => {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const db = serverDb()
  const [{ data: emps }, { data: pins }, { data: open }] = await Promise.all([
    db.from('employees').select('*').order('name'),
    db.from('employee_pins').select('employee_id, is_temp, locked_until, updated_at'),
    readAllRows<{ employee_id: string; department_id: string; start_date: string; departments: { name: string } | { name: string }[] | null }>(
      () => db.from('employee_departments').select('employee_id, department_id, start_date, departments(name)').is('end_date', null), ['employee_id']
    ).then((data) => ({ data })),
  ])
  const deptMap = new Map((open ?? []).map((o) => [o.employee_id, o]))
  const pinMap = new Map((pins ?? []).map((p) => [p.employee_id, p]))
  const list = (emps ?? []).map((e) => {
    const p = pinMap.get(e.id)
    const locked = !!p?.locked_until && new Date(p.locked_until).getTime() > Date.now()
    const d = deptMap.get(e.id) as { department_id: string; start_date: string; departments: { name: string } | { name: string }[] | null } | undefined
    const deptName = d ? (Array.isArray(d.departments) ? d.departments[0]?.name : d.departments?.name) ?? null : null
    return {
      ...e,
      pin_status: !p ? 'none' : locked ? 'locked' : p.is_temp ? 'temp' : 'set',
      // PIN을 마지막으로 정한 시각(직원이 직접 정함·바꿈 또는 관리자 발급). 로그인 실패·잠금으로는 바뀌지 않음(11-23 TK)
      pin_set_at: p?.updated_at ?? null,
      department: d ? { id: d.department_id, name: deptName, since: d.start_date } : null,
    }
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
