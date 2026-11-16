import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, limitWrites, ok, readJson, requireEmployee } from '@/lib/server/guard'
import { isMissingTable, vapidConfig } from '@/lib/server/push'

export const dynamic = 'force-dynamic'

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// 내 운동 알람 설정 보기 — 본인만
export const GET = handle(async () => {
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  const cfg = vapidConfig()
  const db = serverDb()
  const { data, error } = await db.from('exercise_reminders').select('enabled, minute_of_day, days').eq('employee_id', auth.employeeId).maybeSingle()
  if (isMissingTable(error) || !cfg) return ok({ ready: false })
  if (error) throw new Error('REMINDER_LOAD_FAILED')
  const { count } = await db.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('employee_id', auth.employeeId)
  return ok({
    ready: true,
    vapidKey: cfg.pub,
    devices: count ?? 0,
    reminder: data ? { enabled: data.enabled, time: toHHMM(data.minute_of_day), days: data.days } : null,
  })
})

// 내 운동 알람 설정 저장 — 본인만. 시간은 한국 시간 10분 단위
export const PUT = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth

  const body = await readJson<{ enabled?: unknown; time?: unknown; days?: unknown }>(req)
  if (typeof body?.enabled !== 'boolean') return fail(400, '알람을 켤지 끌지 골라주세요.')
  const m = typeof body.time === 'string' ? /^([01]\d|2[0-3]):([0-5]0)$/.exec(body.time) : null
  if (!m) return fail(400, '시간은 10분 단위로 골라주세요.')
  const days = Array.isArray(body.days) ? [...new Set(body.days)].filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6).sort() : []
  if (body.enabled && days.length === 0) return fail(400, '알람을 받을 요일을 하나 이상 골라주세요.')

  const minute_of_day = Number(m[1]) * 60 + Number(m[2])
  // 시간·요일을 바꾸면 오늘 다시 울릴 수 있게 '오늘 보냄' 표시를 지웁니다
  const { error } = await serverDb().from('exercise_reminders').upsert(
    { employee_id: auth.employeeId, enabled: body.enabled, minute_of_day, days, last_sent_date: null, updated_at: new Date().toISOString() },
    { onConflict: 'employee_id' },
  )
  if (isMissingTable(error)) return fail(503, '운동 알람은 준비 중이에요.')
  if (error) throw new Error('REMINDER_SAVE_FAILED')
  return ok({ reminder: { enabled: body.enabled, time: toHHMM(minute_of_day), days } })
})
