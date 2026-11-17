import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, limitWrites, ok, readJson, requireEmployee, writeAudit } from '@/lib/server/guard'
import { myGame, placeDecor } from '@/lib/server/game'

export const dynamic = 'force-dynamic'

// 나의 정원 — 칸에 장식 놓기·옮기기·빼기. 가진 장식만(서버 확인 + DB 외래키). 본인 정원만.
// (부서 정원 조회는 /api/me/garden — 뜻이 달라 따로 둠)
export const PUT = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth

  const body = await readJson<{ slot?: unknown; item?: unknown }>(req)
  const slot = typeof body?.slot === 'number' ? body.slot : NaN
  const item = body?.item === null ? null : typeof body?.item === 'string' ? body.item : undefined
  if (item === undefined) return fail(400, '장식을 골라주세요.')
  const db = serverDb()
  const r = await placeDecor(db, auth.employeeId, slot, item)
  if (r.status === 'invalid') return fail(400, '칸이나 장식이 올바르지 않아요.')
  if (r.status === 'not_owned') return fail(403, '먼저 햇빛으로 장식을 받아 주세요.', { code: 'not_owned' })
  if (r.status === 'not_ready') return fail(503, '정원 꾸미기는 준비 중이에요.', { code: 'not_ready' })
  await writeAudit({ table: 'garden_placements', recordId: null, action: item === null ? 'delete' : 'update', actorType: 'employee', actorEmployeeId: auth.employeeId, after: { slot, item_key: item } })
  return ok({ game: await myGame(db, auth.employeeId) })
})
