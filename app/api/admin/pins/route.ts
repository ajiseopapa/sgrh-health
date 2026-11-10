import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { generateTempPin, hashPin } from '@/lib/server/pin'
import { revokeEmployeeSessions } from '@/lib/server/session'
import { UUID_RE } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, writeAudit } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

/**
 * 임시 PIN 발급
 * - mode 'missing': PIN이 없는 직원 전원에게 발급 (처음 도입할 때)
 * - mode 'reset'  : 한 명의 PIN을 초기화 (기존 로그인 세션 전부 무효화)
 *
 * 발급한 PIN 원문은 이 응답에 한 번만 담기고, DB·서버 로그 어디에도 남지 않습니다.
 * 감사 로그에는 "누구에게 발급했는지"만 기록합니다.
 */
export const POST = handle(async (req: NextRequest) => {
  const g = await guardAdminWrite(req)
  if (g) return g

  const body = await readJson<{ mode?: string; employeeId?: string }>(req)
  const db = serverDb()

  let targets: { id: string; name: string; employee_number: string }[] = []
  if (body?.mode === 'missing') {
    const [{ data: emps }, { data: pins }] = await Promise.all([
      db.from('employees').select('id, name, employee_number').order('name'),
      db.from('employee_pins').select('employee_id'),
    ])
    const has = new Set((pins ?? []).map((p) => p.employee_id))
    targets = (emps ?? []).filter((e) => !has.has(e.id))
  } else if (body?.mode === 'reset' && UUID_RE.test(String(body.employeeId ?? ''))) {
    const { data: emp } = await db.from('employees').select('id, name, employee_number').eq('id', body.employeeId!).maybeSingle()
    if (!emp) return fail(404, '직원을 찾을 수 없어요.')
    targets = [emp]
  } else {
    return fail(400, '요청 형식이 올바르지 않아요.')
  }

  if (targets.length === 0) return ok({ issued: [] })

  const issued: { employeeId: string; name: string; employeeNumber: string; pin: string }[] = []
  const rows = targets.map((t) => {
    const pin = generateTempPin()
    issued.push({ employeeId: t.id, name: t.name, employeeNumber: t.employee_number, pin })
    return {
      employee_id: t.id,
      pin_hash: hashPin(pin),
      is_temp: true,
      failed_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    }
  })

  const { error } = await db.from('employee_pins').upsert(rows, { onConflict: 'employee_id' })
  if (error) throw new Error('PIN_ISSUE_FAILED')

  for (const t of targets) await revokeEmployeeSessions(t.id)

  await writeAudit({
    table: 'employee_pins',
    recordId: null,
    action: 'update',
    actorType: 'admin',
    after: { mode: body.mode, employee_ids: targets.map((t) => t.id) },
  })

  return ok({ issued })
})
