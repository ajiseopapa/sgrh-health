import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, limitWrites, ok, readJson, requireEmployee, writeAudit } from '@/lib/server/guard'
import { validateLogInput } from '@/lib/server/validate'

export const dynamic = 'force-dynamic'

const REQUEST_ID_RE = /^[A-Za-z0-9-]{8,64}$/

// 운동 기록 작성 — 본인만, 쿠키의 직원 ID로 저장 (화면에서 보낸 직원 ID는 쓰지 않음)
export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited

  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth

  const body = await readJson<Record<string, unknown>>(req)
  const v = validateLogInput(body)
  if ('error' in v) return fail(400, v.error)

  const requestId = String(body?.requestId ?? '')
  if (!REQUEST_ID_RE.test(requestId)) return fail(400, '요청 형식이 올바르지 않아요.')

  const db = serverDb()

  const { data: type } = await db.from('exercise_types').select('id').eq('id', v.value.exercise_type_id).maybeSingle()
  if (!type) return fail(400, '운동 종목을 다시 선택해주세요.')

  // 같은 요청 번호가 이미 저장됐으면 그 기록을 그대로 돌려줌 (버튼 두 번 누름·재전송)
  const { data: same } = await db.from('exercise_logs').select('id').eq('client_request_id', requestId).maybeSingle()
  if (same) return ok({ id: same.id, duplicate: true })

  // 1분 안에 똑같은 기록이 또 들어오면 막음
  const { data: recent } = await db
    .from('exercise_logs')
    .select('id')
    .eq('employee_id', auth.employeeId)
    .eq('log_date', v.value.log_date)
    .eq('exercise_type_id', v.value.exercise_type_id)
    .eq('duration_seconds', v.value.duration_seconds)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString())
    .limit(1)
  if (recent && recent.length > 0) return fail(409, '방금 같은 기록을 저장했어요.', { duplicate: true })

  const row = { ...v.value, employee_id: auth.employeeId, client_request_id: requestId }
  const { data, error } = await db.from('exercise_logs').insert(row).select('*').single()
  if (error) {
    if (error.code === '23505') {
      const { data: again } = await db.from('exercise_logs').select('id').eq('client_request_id', requestId).maybeSingle()
      return ok({ id: again?.id ?? null, duplicate: true })
    }
    throw new Error('LOG_INSERT_FAILED')
  }

  await writeAudit({ table: 'exercise_logs', recordId: data.id, action: 'insert', actorType: 'employee', actorEmployeeId: auth.employeeId, after: data })
  return ok({ id: data.id })
})
