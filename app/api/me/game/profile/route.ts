import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, limitWrites, ok, readJson, requireEmployee } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

// 피드에 내 나무·캐릭터 보이기(본인 선택, 기본 꺼짐)
export const PUT = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  const body = await readJson<{ showInFeed?: unknown }>(req)
  if (typeof body?.showInFeed !== 'boolean') return fail(400, '켜기·끄기를 골라주세요.')
  const { error } = await serverDb().from('game_profiles')
    .upsert({ employee_id: auth.employeeId, show_in_feed: body.showInFeed, updated_at: new Date().toISOString() }, { onConflict: 'employee_id' })
  if (error) throw new Error('PROFILE_SAVE_FAILED')
  return ok({ showInFeed: body.showInFeed })
})
