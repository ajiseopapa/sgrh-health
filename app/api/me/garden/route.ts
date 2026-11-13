import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { handle, ok, requireEmployee } from '@/lib/server/guard'
import { myGarden } from '@/lib/server/game'

export const dynamic = 'force-dynamic'

// 내 부서 정원 — 숫자(기여 일수·참여 인원)와 해금 장식만. 다른 직원 이름·미참여자는 내보내지 않음
export const GET = handle(async () => {
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  return ok(await myGarden(serverDb(), auth.employeeId))
})
