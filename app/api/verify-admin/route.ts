import { NextRequest } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createSession } from '@/lib/server/session'
import { checkCsrf, clientIpHash, fail, handle, hitRateLimit, LIMITS, ok, readJson } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

function sameSecret(a: string, b: string) {
  // 길이가 달라도 비교 시간이 같도록 해시끼리 비교
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

// 관리자 비밀번호 확인 → 맞으면 8시간짜리 관리자 세션 쿠키 발급
export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf

  const correct = process.env.ADMIN_PASSWORD
  if (!correct) return fail(500, 'ADMIN_PASSWORD가 서버에 설정되어 있지 않아요.')

  if (!(await hitRateLimit(`admin-ip:${clientIpHash(req)}`, LIMITS.adminPerIp.limit, LIMITS.adminPerIp.window))) {
    return fail(429, '시도가 너무 많아요. 15분 뒤에 다시 해주세요.')
  }

  const body = await readJson<{ password?: string }>(req)
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!password || !sameSecret(password, correct)) return fail(401, '비밀번호가 올바르지 않아요.')

  await createSession('admin', null)
  return ok()
})
