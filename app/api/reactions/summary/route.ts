import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, ok, readJson } from '@/lib/server/guard'
import { getSession } from '@/lib/server/session'
import { DEVICE_RE, UUID_RE } from '@/lib/server/validate'
import { CHEER_EMOJIS } from '@/types/database'

export const dynamic = 'force-dynamic'

const MAX_LOGS = 100

/**
 * 피드 응원 요약 — 기록·이모지별 응원 수와 "내가 눌렀는지"만 돌려줍니다.
 * "나" = 로그인했으면 그 직원(어느 기기에서 눌렀든), 아니면 이 기기.
 * 다른 기기의 식별값·누가 눌렀는지는 화면에 내려보내지 않습니다(남의 값으로 응원을 끄는 일을 막기 위해).
 * 본문으로 받는 이유: 기기 식별값을 주소(URL)·서버 접속 기록에 남기지 않으려고.
 */
export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf

  const body = await readJson<{ logIds?: unknown; deviceId?: string }>(req)
  const logIds = Array.isArray(body?.logIds) ? body.logIds.map(String) : []
  if (logIds.length === 0) return ok({ cheers: [] })
  if (logIds.length > MAX_LOGS || !logIds.every((id) => UUID_RE.test(id))) {
    return fail(400, '요청 형식이 올바르지 않아요.')
  }
  const deviceId = String(body?.deviceId ?? '')
  const myDevice = DEVICE_RE.test(deviceId) ? deviceId : null
  const myEmployee = (await getSession('employee'))?.employeeId ?? null

  // 한 번에 1,000행까지만 오므로 나눠 읽습니다(응원이 많아도 개수가 잘리지 않게)
  const rows: { log_id: string; emoji: string; device_id: string | null; employee_id: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await serverDb()
      .from('log_reactions')
      .select('log_id, emoji, device_id, employee_id')
      .in('log_id', logIds)
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error('REACTION_SUMMARY_FAILED')
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const map = new Map<string, { log_id: string; emoji: string; count: number; mine: boolean }>()
  for (const r of rows) {
    if (!(CHEER_EMOJIS as readonly string[]).includes(r.emoji)) continue
    const key = `${r.log_id}|${r.emoji}`
    const e = map.get(key) ?? { log_id: r.log_id, emoji: r.emoji, count: 0, mine: false }
    e.count++
    if (r.employee_id) {
      if (myEmployee && r.employee_id === myEmployee) e.mine = true
    } else if (myDevice && r.device_id === myDevice) {
      // 직원 칸이 빈 줄 = 로그인 없이(또는 직원 기준 이전에) 이 기기에서 누른 응원
      e.mine = true
    }
    map.set(key, e)
  }
  return ok({ cheers: [...map.values()] })
})
