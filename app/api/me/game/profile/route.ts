import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { isNameEmoji } from '@/lib/game'
import { checkCsrf, fail, handle, limitWrites, ok, readJson, requireEmployee } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

// 피드에 내 나무 보이기(본인 선택, 기본 꺼짐) · 피드 이름 앞 이모지(정해진 목록 또는 없음)
export const PUT = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  const body = await readJson<{ showInFeed?: unknown; nameEmoji?: unknown }>(req)
  const row: Record<string, unknown> = { employee_id: auth.employeeId, updated_at: new Date().toISOString() }
  if (body && 'showInFeed' in body) {
    if (typeof body.showInFeed !== 'boolean') return fail(400, '켜기·끄기를 골라주세요.')
    row.show_in_feed = body.showInFeed
  }
  if (body && 'nameEmoji' in body) {
    if (body.nameEmoji !== null && !isNameEmoji(body.nameEmoji)) return fail(400, '목록에 있는 이모지를 골라주세요.')
    row.name_emoji = body.nameEmoji
  }
  if (!('show_in_feed' in row) && !('name_emoji' in row)) return fail(400, '바꿀 내용을 골라주세요.')
  // 보낸 칸만 바꿉니다(다른 칸은 그대로)
  const { error } = await serverDb().from('game_profiles').upsert(row, { onConflict: 'employee_id' })
  if (error) throw new Error('PROFILE_SAVE_FAILED')
  return ok({ showInFeed: row.show_in_feed, nameEmoji: row.name_emoji })
})
