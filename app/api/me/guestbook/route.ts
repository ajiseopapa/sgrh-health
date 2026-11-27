import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, handle, ok, requireEmployee } from '@/lib/server/guard'
import { GB_NO_COLUMN, GB_NOT_READY } from '@/lib/server/guestbook'

export const dynamic = 'force-dynamic'

// 내 정원 방명록 새 글 알림
//  GET  → { unread, latest } — 마지막으로 본 뒤 동료가 남긴 글 수와 가장 최근 글(쓴 사람·시각).
//         정원 탭 점 표시와, 푸시를 받은 기기(public/sw.js)가 잠금 화면 문구를 정할 때 씁니다. 글 내용은 내보내지 않음.
//  POST → 지금 봤음(guestbook_seen_at = 지금)
// 037·038 전 DB 면 unread 0 (본 시각을 저장할 수 없어 점이 계속 남는 일이 없게)
export const GET = handle(async () => {
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  const db = serverDb()
  const { data: p, error: pErr } = await db.from('game_profiles').select('guestbook_seen_at').eq('employee_id', auth.employeeId).maybeSingle()
  if (pErr) {
    if (GB_NO_COLUMN.has(pErr.code)) return ok({ unread: 0, latest: null })
    throw new Error('GUESTBOOK_SEEN_READ_FAILED')
  }
  const seenAt = (p as { guestbook_seen_at?: string | null } | null)?.guestbook_seen_at ?? null
  let q = db.from('garden_guestbook').select('author_id, created_at', { count: 'exact' })
    .eq('owner_id', auth.employeeId).neq('author_id', auth.employeeId)
    .order('created_at', { ascending: false }).limit(1)
  if (seenAt) q = q.gt('created_at', seenAt)
  const { data, count, error } = await q
  if (error) {
    if (GB_NOT_READY.has(error.code)) return ok({ unread: 0, latest: null })
    throw new Error('GUESTBOOK_UNREAD_FAILED')
  }
  const top = data?.[0] as { author_id: string; created_at: string } | undefined
  let latest: { name: string; createdAt: string } | null = null
  if (top) {
    const { data: e } = await db.from('employees').select('name').eq('id', top.author_id).maybeSingle()
    latest = { name: (e?.name as string) ?? '동료', createdAt: top.created_at }
  }
  return ok({ unread: count ?? 0, latest })
})

export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  const { error } = await serverDb().from('game_profiles')
    .upsert({ employee_id: auth.employeeId, guestbook_seen_at: new Date().toISOString() }, { onConflict: 'employee_id' })
  if (error && !GB_NO_COLUMN.has(error.code)) throw new Error('GUESTBOOK_SEEN_SAVE_FAILED')
  return ok({ saved: !error })
})
