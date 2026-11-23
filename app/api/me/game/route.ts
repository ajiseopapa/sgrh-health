import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { handle, ok, requireEmployee } from '@/lib/server/guard'
import { myGame } from '@/lib/server/game'

export const dynamic = 'force-dynamic'

// 내 나무·햇빛·캐릭터 — 본인 세션의 직원 ID만 씁니다(다른 직원 ID를 받지 않음)
export const GET = handle(async () => {
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  return ok(await myGame(serverDb(), auth.employeeId))
})
