// 로그인 세션: 쿠키에는 무작위 토큰만, DB에는 그 토큰의 SHA-256 해시만 저장합니다.
// 쿠키는 HttpOnly(스크립트로 못 읽음) + Secure(운영 https) + SameSite=Lax.
import { cookies } from 'next/headers'
import { randomBytes, createHash } from 'crypto'
import { serverDb } from './db'

export type Role = 'employee' | 'admin'

const COOKIE: Record<Role, string> = { employee: 'sgrh_me', admin: 'sgrh_admin' }
const MAX_AGE: Record<Role, number> = { employee: 90 * 24 * 3600, admin: 8 * 3600 }

function sha256(v: string) {
  return createHash('sha256').update(v).digest('hex')
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export async function createSession(role: Role, employeeId: string | null) {
  const token = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + MAX_AGE[role] * 1000)
  const { error } = await serverDb().from('auth_sessions').insert({
    token_hash: sha256(token),
    role,
    employee_id: employeeId,
    expires_at: expires.toISOString(),
  })
  if (error) throw new Error('SESSION_CREATE_FAILED')
  cookies().set(COOKIE[role], token, cookieOptions(MAX_AGE[role]))
}

export interface Session {
  id: string
  role: Role
  employeeId: string | null
}

export async function getSession(role: Role): Promise<Session | null> {
  const token = cookies().get(COOKIE[role])?.value
  if (!token) return null
  const { data } = await serverDb()
    .from('auth_sessions')
    .select('id, role, employee_id, expires_at')
    .eq('token_hash', sha256(token))
    .eq('role', role)
    .maybeSingle()
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) return null
  return { id: data.id, role: data.role, employeeId: data.employee_id }
}

/** 지금 기기의 세션을 서버에서 지우고 쿠키도 지웁니다. */
export async function destroySession(role: Role) {
  const token = cookies().get(COOKIE[role])?.value
  if (token) await serverDb().from('auth_sessions').delete().eq('token_hash', sha256(token))
  cookies().set(COOKIE[role], '', cookieOptions(0))
}

/** 한 직원의 모든 기기 세션을 무효화합니다 (PIN 변경·초기화 때). */
export async function revokeEmployeeSessions(employeeId: string) {
  await serverDb().from('auth_sessions').delete().eq('employee_id', employeeId).eq('role', 'employee')
}
