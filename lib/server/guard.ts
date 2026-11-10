// API 공통 보호: CSRF 확인, 요청 제한, 본인·관리자 확인, 응답 헬퍼, 감사 로그.
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { serverDb } from './db'
import { getSession, Session } from './session'

export const CSRF_HEADER = 'x-sgrh-request'

/** 오류 응답. 서버 로그에는 요청 본문(PIN 등)을 절대 남기지 않습니다. */
export function fail(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store' } })
}

/**
 * 상태를 바꾸는 요청의 CSRF 방어.
 * ① 화면 코드만 붙이는 전용 헤더가 있어야 함 — 다른 사이트는 이 헤더를 붙여 보낼 수 없음(브라우저가 사전 확인에서 막음)
 * ② Origin이 있으면 우리 주소와 같아야 함
 * (쿠키 SameSite=Lax 와 함께 3중 방어)
 */
export function checkCsrf(req: NextRequest): NextResponse | null {
  if (req.headers.get(CSRF_HEADER) !== '1') return fail(403, '허용되지 않은 요청이에요.')
  const origin = req.headers.get('origin')
  if (origin) {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    let originHost = ''
    try { originHost = new URL(origin).host } catch { /* 잘못된 Origin */ }
    if (!host || originHost !== host) return fail(403, '허용되지 않은 요청이에요.')
  }
  return null
}

export function clientIpHash(req: NextRequest): string {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.ip || 'unknown'
  return createHash('sha256').update(`sgrh-ip:${ip}`).digest('hex').slice(0, 32)
}

/** true면 통과, false면 한도 초과. DB 함수가 원자적으로 셉니다. */
export async function hitRateLimit(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await serverDb().rpc('hit_rate_limit', {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) throw new Error('RATE_LIMIT_FAILED')
  return data === true
}

/** 횟수를 올리지 않고 지금 한도를 넘었는지만 봅니다 (실패 횟수 확인용). */
export async function isRateLimited(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data } = await serverDb().from('rate_limits').select('window_start, hits').eq('bucket', bucket).maybeSingle()
  if (!data) return false
  if (new Date(data.window_start).getTime() < Date.now() - windowSeconds * 1000) return false
  return data.hits >= limit
}

/**
 * 병원은 직원 전체가 같은 공인 IP(공유기 하나)로 나가는 경우가 많아서,
 * IP 기준 한도는 "정상 사용을 막지 않을 만큼" 크게 잡습니다.
 * 무차별 대입은 직원별 5회 잠금 + IP별 "실패" 횟수 제한으로 막습니다.
 */
export const LIMITS = {
  loginAllPerIp: { limit: 300, window: 600 },   // 모든 로그인 시도, 10분 300회 (전 직원 동시 배부일 대비)
  loginFailPerIp: { limit: 30, window: 600 },   // 실패한 로그인, 10분 30회
  pinChangePerIp: { limit: 150, window: 600 },
  adminPerIp: { limit: 10, window: 900 },       // 관리자 비밀번호, 15분 10회 (관리자는 소수)
  writesPerIp: { limit: 300, window: 60 },      // 쓰기 전체, 분당 300회
}

/** IP별 쓰기 요청 제한. 넘으면 오류 응답을, 통과면 null을 돌려줍니다. */
export async function limitWrites(req: NextRequest): Promise<NextResponse | null> {
  const okay = await hitRateLimit(`write-ip:${clientIpHash(req)}`, LIMITS.writesPerIp.limit, LIMITS.writesPerIp.window)
  return okay ? null : fail(429, '요청이 너무 많아요. 잠시 후 다시 시도해주세요.')
}

export interface EmployeeAuth { session: Session; employeeId: string }

/**
 * 직원 본인 확인. 임시 PIN 상태면 기록 작성 등은 막습니다(PIN을 먼저 바꿔야 함).
 */
export async function requireEmployee(opts: { allowTempPin?: boolean } = {}): Promise<EmployeeAuth | NextResponse> {
  const session = await getSession('employee')
  if (!session || !session.employeeId) return fail(401, '먼저 본인 확인을 해주세요.', { needLogin: true })
  if (!opts.allowTempPin) {
    const { data } = await serverDb().from('employee_pins').select('is_temp').eq('employee_id', session.employeeId).maybeSingle()
    if (!data) return fail(401, '먼저 본인 확인을 해주세요.', { needLogin: true })
    if (data.is_temp) return fail(403, '임시 PIN을 내 PIN으로 먼저 바꿔주세요.', { mustChangePin: true })
  }
  return { session, employeeId: session.employeeId }
}

export async function requireAdmin(): Promise<Session | NextResponse> {
  const session = await getSession('admin')
  if (!session) return fail(401, '관리자 확인이 필요해요.', { needAdmin: true })
  return session
}

/** 관리자 쓰기 요청 공통 확인: CSRF → 요청 제한 → 관리자 세션. 통과하면 null. */
export async function guardAdminWrite(req: NextRequest): Promise<NextResponse | null> {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin
  return null
}

export async function isAdminRequest(): Promise<boolean> {
  return (await getSession('admin')) !== null
}

export async function writeAudit(entry: {
  table: string
  recordId: string | null
  action: 'insert' | 'update' | 'delete'
  actorType: 'employee' | 'admin' | 'system'
  actorEmployeeId?: string | null
  before?: unknown
  after?: unknown
}) {
  await serverDb().from('audit_logs').insert({
    table_name: entry.table,
    record_id: entry.recordId,
    action: entry.action,
    actor_type: entry.actorType,
    actor_employee_id: entry.actorEmployeeId ?? null,
    before_data: entry.before ?? null,
    after_data: entry.after ?? null,
  })
}

export async function readJson<T>(req: NextRequest): Promise<T | null> {
  try { return (await req.json()) as T } catch { return null }
}

/** 예상하지 못한 오류를 감싸 일반 메시지로 돌려줍니다. 요청 본문은 로그에 남기지 않습니다. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<NextResponse>) {
  return async (...args: A) => {
    try {
      return await fn(...args)
    } catch (e) {
      const code = e instanceof Error ? e.message : 'UNKNOWN'
      console.error('[api]', code)
      if (code === 'SERVER_DB_NOT_CONFIGURED') return fail(500, '서버 설정이 아직 끝나지 않았어요. 관리자에게 알려주세요.')
      return fail(500, '처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.')
    }
  }
}
