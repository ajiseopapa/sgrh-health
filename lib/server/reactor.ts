// 피드 응원을 "누가 눌렀는지" 구분하는 키.
//  · 본인 확인을 한 직원: 직원 기준 키(emp-…) → PC와 폰에서 눌러도 한 번만 셉니다(11-19 TK).
//    직원 번호를 그대로 저장하지 않고 서버 비밀값으로 섞은 값이라, DB만 봐서는 누가 눌렀는지 알 수 없습니다(익명 유지).
//  · 본인 확인 전: 지금처럼 기기 기준.
// 예전에 기기 기준으로 눌러 둔 응원은, 그 기기에서 본인 확인 상태로 피드를 열 때 직원 키로 옮깁니다(겹치면 하나만 남김).
import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSession } from './session'

export async function reactorKey(deviceId: string | null): Promise<string | null> {
  const s = await getSession('employee')
  if (!s?.employeeId) return deviceId
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return `emp-${createHash('sha256').update(`${s.employeeId}:${salt}`).digest('hex').slice(0, 40)}`
}

/** 이 기기로 눌러 둔 응원을 직원 키로 옮김. 같은 기록·이모지를 이미 직원 키로 눌렀으면 기기 쪽 줄은 지움 */
export async function adoptDeviceReactions(db: SupabaseClient, deviceId: string | null, key: string | null) {
  if (!deviceId || !key || deviceId === key) return
  const { data } = await db.from('log_reactions').select('id').eq('device_id', deviceId).limit(500)
  for (const r of data ?? []) {
    const { error } = await db.from('log_reactions').update({ device_id: key }).eq('id', r.id)
    if (error) await db.from('log_reactions').delete().eq('id', r.id) // 유니크 충돌 = 이미 직원 키로 있음
  }
}
