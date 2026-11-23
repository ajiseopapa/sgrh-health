import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { verifyPin, PIN_RE } from '@/lib/server/pin'
import { createSession } from '@/lib/server/session'
import { checkCsrf, clientIpHash, fail, handle, hitRateLimit, isRateLimited, LIMITS, ok, readJson } from '@/lib/server/guard'
import { todaySeoul, UUID_RE } from '@/lib/server/validate'

export const dynamic = 'force-dynamic'

const MAX_FAILS = 5
const LOCK_MINUTES = 15

export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf

  const ip = clientIpHash(req)
  const failBucket = `loginfail-ip:${ip}`
  const tooMany = () => fail(429, '틀린 시도가 너무 많아요. 10분 뒤에 다시 해주세요.')

  // ① IP별 전체 시도(넉넉하게) ② IP별 실패 횟수(엄격하게) — 실패 한도를 넘었으면 PIN을 보지도 않음
  if (!(await hitRateLimit(`login-ip:${ip}`, LIMITS.loginAllPerIp.limit, LIMITS.loginAllPerIp.window))) return tooMany()
  if (await isRateLimited(failBucket, LIMITS.loginFailPerIp.limit, LIMITS.loginFailPerIp.window)) return tooMany()
  const countFail = () => hitRateLimit(failBucket, LIMITS.loginFailPerIp.limit, LIMITS.loginFailPerIp.window)

  const body = await readJson<{ employeeId?: string; pin?: string }>(req)
  const employeeId = String(body?.employeeId ?? '')
  const pin = String(body?.pin ?? '')
  if (!UUID_RE.test(employeeId) || !PIN_RE.test(pin)) return fail(400, '이름을 고르고 PIN 6자리를 입력해주세요.')

  const db = serverDb()
  const { data: row } = await db
    .from('employee_pins')
    .select('pin_hash, is_temp, failed_count, locked_until')
    .eq('employee_id', employeeId)
    .maybeSingle()

  if (!row) {
    await countFail() // 없는 계정을 훑어보는 시도도 실패로 셈
    return fail(400, '아직 PIN이 발급되지 않았어요. 관리자에게 요청해주세요.')
  }

  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    await countFail() // 잠긴 계정에 계속 시도하는 것도 실패로 셈
    const min = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60000)
    return fail(423, `PIN을 5번 틀려서 잠겼어요. ${min}분 뒤에 다시 해주세요.`, { locked: true })
  }

  if (!verifyPin(pin, row.pin_hash)) {
    await countFail()
    const fails = (row.failed_count ?? 0) + 1
    if (fails >= MAX_FAILS) {
      await db.from('employee_pins').update({
        failed_count: 0,
        locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString(),
      }).eq('employee_id', employeeId)
      return fail(423, `PIN을 5번 틀려서 ${LOCK_MINUTES}분 동안 잠겼어요.`, { locked: true })
    }
    await db.from('employee_pins').update({ failed_count: fails }).eq('employee_id', employeeId)
    return fail(401, `PIN이 맞지 않아요. (${fails}/${MAX_FAILS})`, { remaining: MAX_FAILS - fails })
  }

  await db.from('employee_pins').update({ failed_count: 0, locked_until: null }).eq('employee_id', employeeId)
  // v2.1: 퇴사 처리된 직원(퇴사일이 지남)은 로그인하지 않음. 기록은 그대로 남습니다.
  const { data: emp } = await db.from('employees').select('left_at').eq('id', employeeId).maybeSingle()
  if (emp?.left_at && emp.left_at < todaySeoul()) return fail(403, '퇴사 처리된 계정이에요. 관리자에게 문의해주세요.')
  await createSession('employee', employeeId)
  return ok({ mustChangePin: row.is_temp })
})
