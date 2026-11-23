import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, limitWrites, ok, readJson, requireEmployee } from '@/lib/server/guard'
import { isMissingTable, isPushEndpoint, pushToEndpoints, vapidConfig } from '@/lib/server/push'

export const dynamic = 'force-dynamic'

const MAX_DEVICES = 5

// 이 기기를 알림 받을 기기로 등록 — 본인만. { endpoint, test? }
// test: true 면 등록하지 않고 내 기기 전체로 시험 알림을 보냅니다.
export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  const cfg = vapidConfig()
  if (!cfg) return fail(503, '운동 알람은 준비 중이에요.')

  const body = await readJson<{ endpoint?: unknown; test?: unknown }>(req)
  const db = serverDb()

  if (body?.test === true) {
    const { data, error } = await db.from('push_subscriptions').select('endpoint').eq('employee_id', auth.employeeId)
    if (isMissingTable(error)) return fail(503, '운동 알람은 준비 중이에요.')
    if (error) throw new Error('PUSH_LOAD_FAILED')
    if (!data?.length) return fail(400, '알림을 받을 기기가 없어요. 먼저 알람을 저장해 주세요.')
    const sent = await pushToEndpoints(db, data.map((r: { endpoint: string }) => r.endpoint), cfg)
    if (sent === 0) return fail(502, '알림을 보내지 못했어요. 알람을 다시 저장해 주세요.')
    return ok({ sent })
  }

  if (!isPushEndpoint(body?.endpoint)) return fail(400, '이 브라우저에서는 알림을 받을 수 없어요.')
  // 같은 기기를 다른 직원이 쓰게 되면 주인을 바꿉니다(한 기기 = 한 사람)
  const { error } = await db.from('push_subscriptions').upsert({ employee_id: auth.employeeId, endpoint: body.endpoint }, { onConflict: 'endpoint' })
  if (isMissingTable(error)) return fail(503, '운동 알람은 준비 중이에요.')
  if (error) throw new Error('PUSH_SAVE_FAILED')
  // 오래된 기기 정리: 최근 5대만 남김
  const { data: all } = await db.from('push_subscriptions').select('id').eq('employee_id', auth.employeeId).order('created_at', { ascending: false })
  const extra = (all ?? []).slice(MAX_DEVICES).map((r: { id: string }) => r.id)
  if (extra.length) await db.from('push_subscriptions').delete().in('id', extra)
  return ok({})
})

// 이 기기 등록 해제 — 본인 것만
export const DELETE = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  const body = await readJson<{ endpoint?: unknown }>(req)
  if (typeof body?.endpoint !== 'string') return fail(400, '기기 정보를 확인하지 못했어요.')
  const { error } = await serverDb().from('push_subscriptions').delete().eq('employee_id', auth.employeeId).eq('endpoint', body.endpoint)
  if (error && !isMissingTable(error)) throw new Error('PUSH_DELETE_FAILED')
  return ok({})
})
