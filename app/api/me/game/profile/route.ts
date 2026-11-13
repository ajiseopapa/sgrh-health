import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { isCharacterKey, isNameEmoji } from '@/lib/game'
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
  const body = await readJson<{ showInFeed?: unknown; nameEmoji?: unknown; character?: unknown }>(req)
  const row: Record<string, unknown> = { employee_id: auth.employeeId, updated_at: new Date().toISOString() }
  if (body && 'showInFeed' in body) {
    if (typeof body.showInFeed !== 'boolean') return fail(400, '켜기·끄기를 골라주세요.')
    row.show_in_feed = body.showInFeed
  }
  if (body && 'nameEmoji' in body) {
    if (body.nameEmoji !== null && !isNameEmoji(body.nameEmoji)) return fail(400, '목록에 있는 이모지를 골라주세요.')
    row.name_emoji = body.nameEmoji
  }
  if (body && 'character' in body) {
    if (!isCharacterKey(body.character)) return fail(400, '캐릭터를 골라주세요.')
    row.character = body.character
  }
  if (!('show_in_feed' in row) && !('name_emoji' in row) && !('character' in row)) return fail(400, '바꿀 내용을 골라주세요.')
  // 보낸 칸만 바꿉니다(다른 칸은 그대로)
  const { error } = await serverDb().from('game_profiles').upsert(row, { onConflict: 'employee_id' })
  if (error) {
    // 029(character 칸) 적용 전 DB: 칸이 없다는 오류 → 준비 중 안내
    if ('character' in row && (error.code === 'PGRST204' || error.code === '42703')) return fail(503, '캐릭터 저장은 준비 중이에요.')
    throw new Error('PROFILE_SAVE_FAILED')
  }
  return ok({ showInFeed: row.show_in_feed, nameEmoji: row.name_emoji, character: row.character })
})
