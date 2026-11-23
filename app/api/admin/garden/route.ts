import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { handle, ok, requireAdmin } from '@/lib/server/guard'
import { gardenAdminNotices } from '@/lib/server/game'

export const dynamic = 'force-dynamic'

// 관리자 안내: 이번 주 공동 정원 목표를 정할 수 없는 부서(인원 정보 없음·불일치)
export const GET = handle(async () => {
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  return ok({ notices: await gardenAdminNotices(serverDb()) })
})
