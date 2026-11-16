import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { fail, handle, ok } from '@/lib/server/guard'
import { isMissingTable, pushToEndpoints, vapidConfig } from '@/lib/server/push'

export const dynamic = 'force-dynamic'

const WINDOW_MIN = 15 // 예약 실행이 한두 번 빠져도 놓치지 않게, 설정 시각 뒤 15분 안이면 보냄

function secretOk(req: NextRequest): boolean {
  const want = process.env.CRON_SECRET
  const got = req.headers.get('x-cron-secret')
  if (!want || !got || want.length < 16) return false
  const a = Buffer.from(want), b = Buffer.from(got)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// 운동 알람 발송 — DB 예약 실행(pg_cron)이 5분마다 부릅니다. 비밀 헤더가 맞아야만 동작.
export const POST = handle(async (req: NextRequest) => {
  if (!secretOk(req)) return fail(401, '허용되지 않은 요청이에요.')
  const cfg = vapidConfig()
  if (!cfg) return ok({ ready: false })

  // 한국 시간 기준 오늘 날짜·요일·분
  const kst = new Date(Date.now() + 9 * 3600 * 1000)
  const today = kst.toISOString().slice(0, 10)
  const dow = kst.getUTCDay()
  const nowMin = kst.getUTCHours() * 60 + kst.getUTCMinutes()

  const db = serverDb()
  const { data: due, error } = await db
    .from('exercise_reminders')
    .select('employee_id, last_sent_date')
    .eq('enabled', true)
    .contains('days', [dow])
    .lte('minute_of_day', nowMin)
    .gt('minute_of_day', nowMin - WINDOW_MIN)
  if (isMissingTable(error)) return ok({ ready: false })
  if (error) throw new Error('REMINDER_DUE_FAILED')

  const ids = (due ?? []).filter((r: { last_sent_date: string | null }) => r.last_sent_date !== today).map((r: { employee_id: string }) => r.employee_id)
  if (ids.length === 0) return ok({ ready: true, due: 0, sent: 0 })

  // 먼저 '오늘 보냄'으로 표시해 겹쳐 실행돼도 두 번 보내지 않게 함
  const { data: claimed, error: cErr } = await db
    .from('exercise_reminders')
    .update({ last_sent_date: today })
    .in('employee_id', ids)
    .or(`last_sent_date.is.null,last_sent_date.neq.${today}`)
    .select('employee_id')
  if (cErr) throw new Error('REMINDER_CLAIM_FAILED')
  const claimedIds = (claimed ?? []).map((r: { employee_id: string }) => r.employee_id)
  if (claimedIds.length === 0) return ok({ ready: true, due: 0, sent: 0 })

  const { data: subs, error: sErr } = await db.from('push_subscriptions').select('endpoint').in('employee_id', claimedIds)
  if (sErr) throw new Error('PUSH_LOAD_FAILED')
  const sent = await pushToEndpoints(db, (subs ?? []).map((r: { endpoint: string }) => r.endpoint), cfg)
  return ok({ ready: true, due: claimedIds.length, sent })
})
