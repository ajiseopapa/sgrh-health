import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { hashPin, weakPinReason } from '@/lib/server/pin'
import { createSession } from '@/lib/server/session'
import { checkCsrf, clientIpHash, fail, handle, hitRateLimit, LIMITS, ok, readJson, writeAudit } from '@/lib/server/guard'
import { todaySeoul, UUID_RE } from '@/lib/server/validate'

export const dynamic = 'force-dynamic'

// 처음 시작하는 직원이 직접 PIN을 정합니다(11-19 TK: 사람이 많아 임시 PIN을 일일이 나눠 주기 어려움).
//  · PIN이 아직 없는 직원만 됩니다. 이미 PIN이 있으면 거절 — 남의 PIN을 덮어쓸 수 없음(바꾸기는 change-pin, 잊었으면 관리자 초기화).
//  · 알고 정한 약점: PIN을 아직 안 정한 동료의 이름으로 누군가 먼저 PIN을 정할 수 있습니다(사번은 직원 목록에 보여서 확인 수단이 못 됨).
//    그 경우 본인은 로그인이 안 되므로 관리자가 PIN 초기화로 되찾아 줍니다. 누가 언제 처음 정했는지는 감사 기록에 남습니다.

/** 이 직원이 PIN을 정했는지 — 본인 확인 창이 "PIN 입력"과 "처음 PIN 정하기" 중 무엇을 보여 줄지 정하는 데 씀 */
export const GET = handle(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!UUID_RE.test(id)) return fail(400, '이름을 골라주세요.')
  if (!(await hitRateLimit(`pinstatus-ip:${clientIpHash(req)}`, LIMITS.loginAllPerIp.limit, LIMITS.loginAllPerIp.window))) {
    return fail(429, '요청이 너무 많아요. 잠시 후 다시 해주세요.')
  }
  const { data } = await serverDb().from('employee_pins').select('employee_id').eq('employee_id', id).maybeSingle()
  return ok({ hasPin: !!data })
})

export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  if (!(await hitRateLimit(`pinsetup-ip:${clientIpHash(req)}`, LIMITS.pinChangePerIp.limit, LIMITS.pinChangePerIp.window))) {
    return fail(429, '시도가 너무 많아요. 10분 뒤에 다시 해주세요.')
  }

  const body = await readJson<{ employeeId?: string; newPin?: string }>(req)
  const employeeId = String(body?.employeeId ?? '')
  const newPin = String(body?.newPin ?? '')
  if (!UUID_RE.test(employeeId)) return fail(400, '이름을 골라주세요.')

  const db = serverDb()
  const { data: emp } = await db.from('employees').select('id, employee_number, left_at').eq('id', employeeId).maybeSingle()
  if (!emp) return fail(404, '직원을 찾을 수 없어요.')
  if (emp.left_at && emp.left_at < todaySeoul()) return fail(403, '퇴사 처리된 계정이에요. 관리자에게 문의해주세요.')

  const weak = weakPinReason(newPin, emp.employee_number)
  if (weak) return fail(400, weak)

  // insert 만 씀(덮어쓰기 없음): 이미 PIN이 있거나 동시에 두 번 눌러도 한 번만 성공
  const { error } = await db.from('employee_pins').insert({
    employee_id: employeeId,
    pin_hash: hashPin(newPin),
    is_temp: false,
    failed_count: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    if (error.code === '23505') return fail(409, '이미 PIN이 정해져 있어요. PIN을 입력해 본인 확인을 해주세요.', { hasPin: true })
    throw new Error('PIN_SETUP_FAILED')
  }

  await writeAudit({ table: 'employee_pins', recordId: null, action: 'insert', actorType: 'employee', actorEmployeeId: employeeId, after: { mode: 'self_setup' } })
  await createSession('employee', employeeId)
  return ok()
})
