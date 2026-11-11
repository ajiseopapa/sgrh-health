import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, limitWrites, ok, readJson } from '@/lib/server/guard'
import { DEVICE_RE, UUID_RE } from '@/lib/server/validate'
import { CHEER_EMOJIS } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * 응원 켜기/끄기 — 익명(기기 기준) 유지.
 *
 * on: true  → 이 기기·기록·이모지 응원을 켭니다. 이미 켜져 있으면 그대로(중복 없음)
 * on: false → 끕니다. 이미 꺼져 있으면 그대로
 * on 없음   → (이전 화면 호환) 지금 상태를 뒤집습니다
 *
 * 같은 기기·기록·이모지는 DB 유니크 인덱스(log_reactions_device_uniq)로 최대 1행이라,
 * 버튼 연타나 동시 요청이 와도 중복 집계되지 않습니다. 원하는 상태를 직접 보내므로
 * 요청이 몇 번 겹쳐도 마지막으로 누른 상태로 끝납니다.
 * 응답에는 서버 기준 최종 상태(on)와 그 이모지의 응원 수(count)를 돌려줍니다.
 */
export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited

  const body = await readJson<{ logId?: string; deviceId?: string; emoji?: string; on?: unknown }>(req)
  const logId = String(body?.logId ?? '')
  const deviceId = String(body?.deviceId ?? '')
  const emoji = String(body?.emoji ?? '')
  if (!UUID_RE.test(logId) || !DEVICE_RE.test(deviceId) || !(CHEER_EMOJIS as readonly string[]).includes(emoji)) {
    return fail(400, '요청 형식이 올바르지 않아요.')
  }
  if (body?.on !== undefined && typeof body.on !== 'boolean') return fail(400, '요청 형식이 올바르지 않아요.')

  const db = serverDb()
  const match = { log_id: logId, device_id: deviceId, emoji }

  let want = body?.on as boolean | undefined
  if (want === undefined) {
    const { data: existing } = await db.from('log_reactions').select('id').match(match).maybeSingle()
    want = !existing
  }

  if (want) {
    // 이미 있으면 아무것도 하지 않음(유니크 인덱스) → 동시 요청이어도 1행
    const { error } = await db
      .from('log_reactions')
      .upsert(match, { onConflict: 'log_id,device_id,emoji', ignoreDuplicates: true })
    if (error) {
      if (error.code === '23503') return fail(404, '기록을 찾을 수 없어요.')
      throw new Error('REACTION_FAILED')
    }
  } else {
    const { error } = await db.from('log_reactions').delete().match(match)
    if (error) throw new Error('REACTION_FAILED')
  }

  const { count, error: cErr } = await db
    .from('log_reactions')
    .select('id', { count: 'exact', head: true })
    .eq('log_id', logId)
    .eq('emoji', emoji)
  if (cErr) throw new Error('REACTION_FAILED')

  return ok({ action: want ? 'added' : 'removed', on: want, count: count ?? 0 })
})
