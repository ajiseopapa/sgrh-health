import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { handle, ok } from '@/lib/server/guard'
import { departmentRanking } from '@/lib/server/engagement'

export const dynamic = 'force-dynamic'

// 부서별 참여 현황 (부서 단위 합계만, 직원 이름·개인 기록은 내보내지 않음)
// 참여율은 인사팀 확인 인원이 입력된 달만 계산하고, 없으면 rate = null("인원 정보 없음")
export const GET = handle(async (req: NextRequest) => {
  const period = req.nextUrl.searchParams.get('period') === 'month' ? 'month' : 'week'
  const r = await departmentRanking(serverDb(), period)
  return ok(r)
})
