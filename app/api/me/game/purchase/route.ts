import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, limitWrites, ok, readJson, requireEmployee, writeAudit } from '@/lib/server/guard'
import { myGame, purchaseItem } from '@/lib/server/game'

export const dynamic = 'force-dynamic'

// 아이템 해금 — 가격과 받은 햇빛은 서버가 계산하고, 잔액 확인·기록은 DB 함수 한 번에(직원별 잠금)
export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth

  const body = await readJson<{ item?: unknown }>(req)
  const item = typeof body?.item === 'string' ? body.item : ''
  const db = serverDb()
  const r = await purchaseItem(db, auth.employeeId, item)
  if (r.status === 'unknown_item' || r.status === 'invalid') return fail(400, '없는 아이템이에요.')
  if (r.status === 'already_owned') return fail(409, '이미 가지고 있는 아이템이에요.', { code: 'already_owned' })
  if (r.status === 'insufficient') return fail(409, '햇빛이 모자라요.', { code: 'insufficient' })
  await writeAudit({ table: 'game_purchases', recordId: null, action: 'insert', actorType: 'employee', actorEmployeeId: auth.employeeId, after: { item_key: item } })
  return ok({ game: await myGame(db, auth.employeeId) })
})
