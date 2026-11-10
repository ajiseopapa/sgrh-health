import { NextRequest } from 'next/server'
import { destroySession } from '@/lib/server/session'
import { checkCsrf, handle, ok } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

// 이 기기의 직원 세션을 서버에서 지웁니다 ("바꾸기")
export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  await destroySession('employee')
  return ok()
})
