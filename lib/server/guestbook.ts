// 정원 방명록 공통 — 글 다듬기, 새 글 푸시
import type { SupabaseClient } from '@supabase/supabase-js'
import { hitRateLimit } from './guard'
import { isMissingTable, pushToEndpoints, vapidConfig } from './push'

export const GUESTBOOK_BODY_MAX = 100
/** 037 실행 전 DB: 표가 없음 */
export const GB_NOT_READY = new Set(['42P01', 'PGRST205'])
/** 038 실행 전 DB: 칸이 없음 */
export const GB_NO_COLUMN = new Set(['42703', 'PGRST204'])

/** 한 줄로 다듬고 길이를 확인. 문제가 있으면 안내 문구(string)를, 괜찮으면 { text } */
export function cleanGuestbookBody(v: unknown): { text: string } | string {
  if (typeof v !== 'string') return '남길 글을 적어주세요.'
  const text = v.replace(/\s+/g, ' ').trim()
  if (!text) return '남길 글을 적어주세요.'
  if ([...text].length > GUESTBOOK_BODY_MAX) return `방명록은 ${GUESTBOOK_BODY_MAX}자까지 적을 수 있어요.`
  return { text }
}

/**
 * 정원 주인에게 새 글 푸시. 운동 알람을 켜 둔 기기(push_subscriptions)로만 갑니다.
 * 푸시는 내용 없는 신호라, 잠금 화면 문구는 기기(public/sw.js)가 /api/me/guestbook 을 물어 정합니다.
 * 같은 정원에 10분 3번까지만(연달아 남겨도 폰이 계속 울리지 않게). 실패해도 글쓰기는 성공으로 둡니다.
 */
export async function pushGuestbookNotice(db: SupabaseClient, ownerId: string): Promise<void> {
  try {
    const cfg = vapidConfig()
    if (!cfg) return
    const { data, error } = await db.from('push_subscriptions').select('endpoint').eq('employee_id', ownerId)
    if (error || !data?.length) { if (error && !isMissingTable(error)) console.error('[guestbook] push load'); return }
    if (!(await hitRateLimit(`gb-push:${ownerId}`, 3, 600))) return
    await pushToEndpoints(db, data.map((r: { endpoint: string }) => r.endpoint), cfg)
  } catch {
    console.error('[guestbook] push failed')
  }
}
