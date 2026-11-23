import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { getSession } from '@/lib/server/session'
import { checkCsrf, fail, handle, limitWrites, ok, readJson, writeAudit } from '@/lib/server/guard'
import { UUID_RE, validateLogInput } from '@/lib/server/validate'

export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

/** 기록 주인(임시 PIN 아님) 또는 관리자만 통과 */
async function authorize(logId: string) {
  const db = serverDb()
  const { data: log } = await db.from('exercise_logs').select('*').eq('id', logId).maybeSingle()
  if (!log) return { error: fail(404, '기록을 찾을 수 없어요.') }

  const admin = await getSession('admin')
  if (admin) return { log, actorType: 'admin' as const, actorEmployeeId: null }

  const emp = await getSession('employee')
  if (!emp?.employeeId) return { error: fail(401, '먼저 본인 확인을 해주세요.', { needLogin: true }) }
  const { data: pin } = await db.from('employee_pins').select('is_temp').eq('employee_id', emp.employeeId).maybeSingle()
  if (!pin) return { error: fail(401, '먼저 본인 확인을 해주세요.', { needLogin: true }) }
  if (pin.is_temp) return { error: fail(403, '임시 PIN을 내 PIN으로 먼저 바꿔주세요.', { mustChangePin: true }) }
  if (log.employee_id !== emp.employeeId) return { error: fail(403, '내 기록만 고치거나 지울 수 있어요.') }
  return { log, actorType: 'employee' as const, actorEmployeeId: emp.employeeId }
}

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')

  const a = await authorize(params.id)
  if ('error' in a) return a.error!

  const v = validateLogInput(await readJson<Record<string, unknown>>(req))
  if ('error' in v) return fail(400, v.error)

  const db = serverDb()
  const { data: type } = await db.from('exercise_types').select('id').eq('id', v.value.exercise_type_id).maybeSingle()
  if (!type) return fail(400, '운동 종목을 다시 선택해주세요.')

  const { data, error } = await db.from('exercise_logs').update(v.value).eq('id', params.id).select('*').single()
  if (error) throw new Error('LOG_UPDATE_FAILED')

  await writeAudit({ table: 'exercise_logs', recordId: params.id, action: 'update', actorType: a.actorType, actorEmployeeId: a.actorEmployeeId, before: a.log, after: data })
  return ok()
})

export const DELETE = handle(async (req: NextRequest, { params }: Ctx) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')

  const a = await authorize(params.id)
  if ('error' in a) return a.error!

  const { error } = await serverDb().from('exercise_logs').delete().eq('id', params.id)
  if (error) throw new Error('LOG_DELETE_FAILED')

  await writeAudit({ table: 'exercise_logs', recordId: params.id, action: 'delete', actorType: a.actorType, actorEmployeeId: a.actorEmployeeId, before: a.log })
  return ok()
})
