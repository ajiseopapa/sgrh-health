import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { cleanText } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, requireAdmin, writeAudit } from '@/lib/server/guard'
import { kstToday, readAllRows } from '@/lib/server/engagement'

export const dynamic = 'force-dynamic'

// 관리자: 부서 목록 + 현재 소속 인원 수(배정 기준) + 이번 달 인사팀 확인 인원
export const GET = handle(async () => {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  const db = serverDb()
  const ym = kstToday().slice(0, 7)
  const [{ data: depts }, { data: open }, { data: heads }] = await Promise.all([
    db.from('departments').select('id, name, sort_order').order('sort_order').order('name'),
    readAllRows<{ employee_id: string; department_id: string; start_date: string }>(
      () => db.from('employee_departments').select('employee_id, department_id, start_date').is('end_date', null), ['employee_id']
    ).then((data) => ({ data })),
    db.from('department_headcounts').select('department_id, year_month, headcount, source, updated_at').order('year_month', { ascending: false }),
  ])
  const members = new Map<string, number>()
  for (const o of open ?? []) members.set(o.department_id, (members.get(o.department_id) ?? 0) + 1)
  return ok({
    yearMonth: ym,
    departments: (depts ?? []).map((d) => ({
      ...d,
      members: members.get(d.id) ?? 0,
      headcount: (heads ?? []).find((h) => h.department_id === d.id && h.year_month === ym) ?? null,
      headcounts: (heads ?? []).filter((h) => h.department_id === d.id).slice(0, 6),
    })),
    assignments: open ?? [],
  })
})

export const POST = handle(async (req: NextRequest) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  const body = await readJson<{ name?: string }>(req)
  const name = cleanText(body?.name, 30)
  if (!name) return fail(400, '부서 이름을 입력해주세요.')
  const db = serverDb()
  const { count } = await db.from('departments').select('id', { count: 'exact', head: true })
  const { data, error } = await db.from('departments').insert({ name, sort_order: count ?? 0 }).select('*').single()
  if (error) return fail(400, error.code === '23505' ? '이미 있는 부서예요.' : '부서를 만들지 못했어요.')
  await writeAudit({ table: 'departments', recordId: data.id, action: 'insert', actorType: 'admin', after: data })
  return ok({ department: data })
})
