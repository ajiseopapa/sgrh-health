import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, limitWrites, ok, readJson, requireEmployee } from '@/lib/server/guard'
import { myGame, setEquipment } from '@/lib/server/game'
import type { Slot } from '@/lib/game'

export const dynamic = 'force-dynamic'

const SLOTS: Slot[] = ['hat', 'top', 'shoes']

// 장착·해제 — 가진 아이템만(서버 확인 + DB 외래키)
export const PUT = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth

  const body = await readJson<{ slot?: unknown; item?: unknown }>(req)
  const slot = body?.slot as Slot
  if (!SLOTS.includes(slot)) return fail(400, '부위를 골라주세요.')
  const item = body?.item === null ? null : typeof body?.item === 'string' ? body.item : undefined
  if (item === undefined) return fail(400, '아이템을 골라주세요.')
  const db = serverDb()
  const r = await setEquipment(db, auth.employeeId, slot, item)
  if (r.status === 'wrong_slot') return fail(400, '이 부위에 맞지 않는 아이템이에요.')
  if (r.status === 'not_owned') return fail(403, '먼저 햇빛으로 해금해 주세요.', { code: 'not_owned' })
  return ok({ game: await myGame(db, auth.employeeId) })
})
