import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { todaySeoul } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, writeAudit } from '@/lib/server/guard'
import { readAllRows } from '@/lib/server/engagement'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 1000

/** 숫자만 있는 5자리 이하 사번은 앞에 0을 채워 6자리로(엑셀·인사 프로그램 내보내기가 앞자리 0을 뗌 — 세계로톡과 같은 규칙) */
const normNumber = (v: string) => (/^\d{1,5}$/.test(v) ? v.padStart(6, '0') : v)
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max + 1) : '')

/**
 * 직원 일괄 등록(엑셀). 줄마다 { employeeNumber, department, position, name } — 열 순서는 사번/부서명/직위/사원명.
 *  · 새 사번만 등록합니다. 이미 있는 사번은 건너뜁니다(이름·부서를 덮어쓰지 않음).
 *  · 부서명이 처음 보는 이름이면 부서를 만들고, 오늘부터 그 부서로 배정합니다. 부서명이 비면 부서 없이 등록.
 *  · 직위는 받기만 하고 저장하지 않습니다(직위를 담을 칸이 아직 없음).
 *  · PIN은 만들지 않습니다 — 직원이 처음 들어올 때 직접 정합니다.
 */
export const POST = handle(async (req: NextRequest) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  const body = await readJson<{ rows?: unknown }>(req)
  const input = Array.isArray(body?.rows) ? body.rows : null
  if (!input || input.length === 0) return fail(400, '등록할 줄이 없어요.')
  if (input.length > MAX_ROWS) return fail(400, `한 번에 ${MAX_ROWS}줄까지 등록할 수 있어요.`)

  const invalid: { line: number; reason: string }[] = []
  const seen = new Set<string>()
  const rows: { employeeNumber: string; department: string; name: string }[] = []
  input.forEach((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>
    const employeeNumber = normNumber(clean(o.employeeNumber, 20))
    const name = clean(o.name, 30)
    const department = clean(o.department, 30)
    const line = i + 1
    if (!employeeNumber) return invalid.push({ line, reason: '사번이 비어 있어요' })
    if (employeeNumber.length > 20) return invalid.push({ line, reason: '사번이 너무 길어요(20자까지)' })
    if (!name) return invalid.push({ line, reason: '이름이 비어 있어요' })
    if (name.length > 30) return invalid.push({ line, reason: '이름이 너무 길어요(30자까지)' })
    if (department.length > 30) return invalid.push({ line, reason: '부서명이 너무 길어요(30자까지)' })
    if (seen.has(employeeNumber)) return invalid.push({ line, reason: `사번 ${employeeNumber}이(가) 파일 안에서 겹쳐요` })
    seen.add(employeeNumber)
    rows.push({ employeeNumber, department, name })
  })

  const db = serverDb()
  const existing = await readAllRows<{ id: string; employee_number: string }>(() => db.from('employees').select('id, employee_number'), ['id'])
  const have = new Set(existing.map((e) => e.employee_number))
  const skipped = rows.filter((r) => have.has(r.employeeNumber)).map((r) => ({ employeeNumber: r.employeeNumber, name: r.name }))
  const fresh = rows.filter((r) => !have.has(r.employeeNumber))

  // 부서: 있는 이름은 그대로, 없는 이름은 새로 만듦
  const { data: depts } = await db.from('departments').select('id, name, sort_order')
  const deptId = new Map((depts ?? []).map((d) => [d.name as string, d.id as string]))
  const newNames = [...new Set(fresh.map((r) => r.department).filter((n) => n && !deptId.has(n)))]
  if (newNames.length) {
    let sort = Math.max(0, ...(depts ?? []).map((d) => Number(d.sort_order) || 0))
    const { data: made, error } = await db.from('departments').insert(newNames.map((name) => ({ name, sort_order: ++sort }))).select('id, name')
    if (error) throw new Error('BULK_DEPT_FAILED')
    for (const d of made ?? []) deptId.set(d.name as string, d.id as string)
  }

  const added: { id: string; employeeNumber: string; name: string }[] = []
  const today = todaySeoul()
  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200)
    const { data, error } = await db.from('employees')
      .insert(chunk.map((r) => ({ name: r.name, employee_number: r.employeeNumber })))
      .select('id, name, employee_number')
    if (error) throw new Error('BULK_EMP_FAILED')
    const idOf = new Map((data ?? []).map((e) => [e.employee_number as string, e.id as string]))
    for (const e of data ?? []) added.push({ id: e.id, employeeNumber: e.employee_number, name: e.name })
    const links = chunk.filter((r) => r.department && idOf.has(r.employeeNumber))
      .map((r) => ({ employee_id: idOf.get(r.employeeNumber)!, department_id: deptId.get(r.department)!, start_date: today }))
    if (links.length) {
      const { error: lErr } = await db.from('employee_departments').insert(links)
      if (lErr) throw new Error('BULK_LINK_FAILED')
    }
  }

  await writeAudit({
    table: 'employees', recordId: null, action: 'insert', actorType: 'admin',
    after: { mode: 'bulk', added: added.length, skipped: skipped.length, invalid: invalid.length, new_departments: newNames, employee_ids: added.map((a) => a.id) },
  })
  return ok({ added: added.length, skipped, invalid, newDepartments: newNames })
})
