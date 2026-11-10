import { NextRequest } from 'next/server'
import { destroySession } from '@/lib/server/session'
import { checkCsrf, handle, ok } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  await destroySession('admin')
  return ok()
})
