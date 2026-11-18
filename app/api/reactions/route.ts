import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, limitWrites, ok, readJson } from '@/lib/server/guard'
import { getSession } from '@/lib/server/session'
import { DEVICE_RE, UUID_RE } from '@/lib/server/validate'
import { CHEER_EMOJIS } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * 응원 켜기/끄기.
 *
 * 누가 눌렀는지의 기준:
 *  - 로그인한 직원 → "직원 기준". 휴대폰·PC 어디서 눌러도 같은 기록·이모지는 1개(035).
 *  - 로그인 안 함 → 이전과 같이 "기기 기준"(익명).
 *
 * on: true  → 응원을 켭니다. 이미 켜져 있으면 그대로(중복 없음)
 * on: false → 끕니다. 이미 꺼져 있으면 그대로
 * on 없음   → (이전 화면 호환) 지금 상태를 뒤집습니다
 *
 * DB 유니크 인덱스(직원: log_reactions_employee_uniq, 기기: log_reactions_device_uniq)로 최대 1행이라,
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
  const employeeId = (await getSession('employee'))?.employeeId ?? null

  // 이 기기가 로그인 없이(또는 직원 기준으로 바뀌기 전에) 남긴 응원. 직원 칸이 빈 줄만 해당합니다.
  const deviceMatch = { log_id: logId, device_id: deviceId, emoji }
  const deviceRows = () => db.from('log_reactions').select('id').match(deviceMatch).is('employee_id', null)

  let want = body?.on as boolean | undefined

  if (employeeId) {
    // ── 직원 기준 ──
    const mineMatch = { log_id: logId, employee_id: employeeId, emoji }
    if (want === undefined) {
      const [{ data: mine }, { data: old }] = await Promise.all([
        db.from('log_reactions').select('id').match(mineMatch).maybeSingle(),
        deviceRows().maybeSingle(),
      ])
      want = !mine && !old
    }

    if (want) {
      // 이미 있으면(23505) 그대로 — 다른 기기에서 먼저 눌렀거나 동시 요청
      const { error } = await db.from('log_reactions').insert(mineMatch)
      if (error && error.code !== '23505') {
        if (error.code === '23503') return fail(404, '기록을 찾을 수 없어요.')
        throw new Error('REACTION_FAILED')
      }
    } else {
      const { error } = await db.from('log_reactions').delete().match(mineMatch)
      if (error) throw new Error('REACTION_FAILED')
    }
    // 이 기기에 남아 있던 예전(기기 기준) 응원은 직원 기준 한 줄로 합칩니다(같은 사람이 2개로 세어지지 않게).
    const { error: oldErr } = await db.from('log_reactions').delete().match(deviceMatch).is('employee_id', null)
    if (oldErr) throw new Error('REACTION_FAILED')
  } else {
    // ── 기기 기준(로그인 안 함) — 이전 동작 그대로 ──
    if (want === undefined) {
      const { data: existing } = await deviceRows().maybeSingle()
      want = !existing
    }

    if (want) {
      // 이미 있으면 아무것도 하지 않음(유니크 인덱스) → 동시 요청이어도 1행
      const { error } = await db
        .from('log_reactions')
        .upsert(deviceMatch, { onConflict: 'log_id,device_id,emoji', ignoreDuplicates: true })
      if (error) {
        if (error.code === '23503') return fail(404, '기록을 찾을 수 없어요.')
        throw new Error('REACTION_FAILED')
      }
    } else {
      const { error } = await db.from('log_reactions').delete().match(deviceMatch).is('employee_id', null)
      if (error) throw new Error('REACTION_FAILED')
    }
  }

  const { count, error: cErr } = await db
    .from('log_reactions')
    .select('id', { count: 'exact', head: true })
    .eq('log_id', logId)
    .eq('emoji', emoji)
  if (cErr) throw new Error('REACTION_FAILED')

  return ok({ action: want ? 'added' : 'removed', on: want, count: count ?? 0 })
})
