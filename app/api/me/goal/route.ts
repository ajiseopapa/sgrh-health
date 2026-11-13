import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, limitWrites, ok, readJson, requireEmployee, writeAudit } from '@/lib/server/guard'
import { kstToday, weekStart } from '@/lib/server/engagement'

export const dynamic = 'force-dynamic'

const LIMIT = { sessions: [1, 21], minutes: [10, 2100] } as const

// 내 주간 목표 정하기·바꾸기 — 본인만. 이번 주(월요일)부터 적용, 지난 주 목표는 그대로 남음
export const PUT = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth

  const body = await readJson<{ kind?: string; target?: unknown }>(req)
  const kind = body?.kind
  if (kind !== 'sessions' && kind !== 'minutes') return fail(400, '목표 종류를 골라주세요.')
  const target = Number(body?.target)
  const [min, max] = LIMIT[kind]
  if (!Number.isInteger(target) || target < min || target > max) {
    return fail(400, kind === 'sessions' ? `횟수는 ${min}~${max}회로 정해주세요.` : `시간은 ${min}~${max}분으로 정해주세요.`)
  }

  const db = serverDb()
  const effective_from = weekStart(kstToday())
  const { data: before } = await db.from('personal_goals').select('*').eq('employee_id', auth.employeeId).eq('effective_from', effective_from).maybeSingle()
  const { data, error } = await db
    .from('personal_goals')
    .upsert({ employee_id: auth.employeeId, kind, target, effective_from, updated_at: new Date().toISOString() }, { onConflict: 'employee_id,effective_from' })
    .select('kind, target, effective_from')
    .single()
  if (error) throw new Error('GOAL_SAVE_FAILED')
  // v2.2: 게임 보상 판정용 변경 이력(주중 변경은 다음 주부터 보상에 반영)
  const { error: hErr } = await db.from('personal_goal_history').insert({ employee_id: auth.employeeId, kind, target })
  if (hErr) throw new Error('GOAL_HISTORY_SAVE_FAILED')
  await writeAudit({ table: 'personal_goals', recordId: null, action: before ? 'update' : 'insert', actorType: 'employee', actorEmployeeId: auth.employeeId, before, after: data })
  return ok({ goal: data })
})
