import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { hashPin, verifyPin, weakPinReason, PIN_RE } from '@/lib/server/pin'
import { createSession, revokeEmployeeSessions } from '@/lib/server/session'
import { checkCsrf, clientIpHash, fail, handle, hitRateLimit, LIMITS, ok, readJson, requireEmployee } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  if (!(await hitRateLimit(`pinchange-ip:${clientIpHash(req)}`, LIMITS.pinChangePerIp.limit, LIMITS.pinChangePerIp.window))) {
    return fail(429, '시도가 너무 많아요. 10분 뒤에 다시 해주세요.')
  }

  const auth = await requireEmployee({ allowTempPin: true })
  if (auth instanceof NextResponse) return auth

  const body = await readJson<{ currentPin?: string; newPin?: string }>(req)
  const currentPin = String(body?.currentPin ?? '')
  const newPin = String(body?.newPin ?? '')
  if (!PIN_RE.test(currentPin)) return fail(400, '지금 PIN 6자리를 입력해주세요.')

  const db = serverDb()
  const [{ data: row }, { data: emp }] = await Promise.all([
    db.from('employee_pins').select('pin_hash').eq('employee_id', auth.employeeId).maybeSingle(),
    db.from('employees').select('employee_number').eq('id', auth.employeeId).maybeSingle(),
  ])
  if (!row) return fail(401, '먼저 본인 확인을 해주세요.', { needLogin: true })
  if (!verifyPin(currentPin, row.pin_hash)) return fail(401, '지금 PIN이 맞지 않아요.')

  const weak = weakPinReason(newPin, emp?.employee_number)
  if (weak) return fail(400, weak)
  if (newPin === currentPin) return fail(400, '지금 PIN과 다른 번호로 정해주세요.')

  await db.from('employee_pins').update({
    pin_hash: hashPin(newPin),
    is_temp: false,
    failed_count: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  }).eq('employee_id', auth.employeeId)

  // 다른 기기를 포함한 기존 세션을 모두 끊고, 지금 기기만 새로 로그인
  await revokeEmployeeSessions(auth.employeeId)
  await createSession('employee', auth.employeeId)
  return ok()
})
