import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { characterOf, isCharacterKey, isNameEmoji, isOutfitKey } from '@/lib/game'
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
  const body = await readJson<{ showInFeed?: unknown; nameEmoji?: unknown; character?: unknown; outfit?: unknown; message?: unknown }>(req)
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
    // 햇빛으로 사는 캐릭터(단발녀)는 산 직원만
    const c = characterOf(body.character)
    if (c.shopKey) {
      const { data: own } = await serverDb().from('game_purchases').select('item_key').eq('employee_id', auth.employeeId).eq('item_key', c.shopKey).maybeSingle()
      if (!own) return fail(403, `${c.name} 캐릭터는 햇빛 ${c.price}개로 먼저 사 주세요.`, { code: 'not_owned' })
    }
    row.character = body.character
  }
  if (body && 'outfit' in body) {
    if (!isOutfitKey(body.outfit)) return fail(400, '의상을 골라주세요.')
    row.outfit = body.outfit
  }
  if (body && 'message' in body) {
    // 한마디: 40자 이내, 줄바꿈 없음. 비우면 지움
    if (body.message !== null && typeof body.message !== 'string') return fail(400, '한마디를 다시 적어주세요.')
    const text = typeof body.message === 'string' ? body.message.replace(/\s+/g, ' ').trim() : ''
    if ([...text].length > 40) return fail(400, '한마디는 40자까지 적을 수 있어요.')
    row.status_message = text || null
  }
  if (!('show_in_feed' in row) && !('name_emoji' in row) && !('character' in row) && !('outfit' in row) && !('status_message' in row)) return fail(400, '바꿀 내용을 골라주세요.')
  // 보낸 칸만 바꿉니다(다른 칸은 그대로)
  const { error } = await serverDb().from('game_profiles').upsert(row, { onConflict: 'employee_id' })
  if (error) {
    // 029(character 칸) 적용 전 DB: 칸이 없다는 오류 → 준비 중 안내
    if ('status_message' in row && (error.code === 'PGRST204' || error.code === '42703')) return fail(503, '한마디 저장은 준비 중이에요.')
    if ('outfit' in row && (error.code === 'PGRST204' || error.code === '42703')) return fail(503, '의상 저장은 준비 중이에요.') // 035 전 DB
    if ('character' in row && (error.code === 'PGRST204' || error.code === '42703')) return fail(503, '캐릭터 저장은 준비 중이에요.')
    if ('character' in row && error.code === '23514') return fail(503, '이 캐릭터는 준비 중이에요.') // 039 전 DB(m·f만 허용)
    throw new Error('PROFILE_SAVE_FAILED')
  }
  return ok({ showInFeed: row.show_in_feed, nameEmoji: row.name_emoji, character: row.character, outfit: row.outfit, message: row.status_message })
})
