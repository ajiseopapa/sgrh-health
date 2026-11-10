import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, limitWrites, ok, readJson } from '@/lib/server/guard'
import { UUID_RE } from '@/lib/server/validate'
import { CHEER_EMOJIS } from '@/types/database'

export const dynamic = 'force-dynamic'

const DEVICE_RE = /^[A-Za-z0-9-]{8,64}$/

// 응원 누르기/취소 — 익명(기기 기준) 유지. 같은 기기·기록·이모지면 취소.
export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited

  const body = await readJson<{ logId?: string; deviceId?: string; emoji?: string }>(req)
  const logId = String(body?.logId ?? '')
  const deviceId = String(body?.deviceId ?? '')
  const emoji = String(body?.emoji ?? '')
  if (!UUID_RE.test(logId) || !DEVICE_RE.test(deviceId) || !(CHEER_EMOJIS as readonly string[]).includes(emoji)) {
    return fail(400, '요청 형식이 올바르지 않아요.')
  }

  const db = serverDb()
  const { data: existing } = await db
    .from('log_reactions')
    .select('id')
    .eq('log_id', logId)
    .eq('device_id', deviceId)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    await db.from('log_reactions').delete().eq('id', existing.id)
    return ok({ action: 'removed', id: existing.id })
  }

  const { data, error } = await db
    .from('log_reactions')
    .insert({ log_id: logId, device_id: deviceId, emoji })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23503') return fail(404, '기록을 찾을 수 없어요.')
    if (error.code === '23505') return ok({ action: 'exists' })
    throw new Error('REACTION_FAILED')
  }
  return ok({ action: 'added', reaction: data })
})
