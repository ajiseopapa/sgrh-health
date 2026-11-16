// 웹 푸시 발송 — 외부 패키지 없이 VAPID 서명만 직접 합니다.
// 내용 없는 푸시(payload 없음)만 보냅니다: 잠금 화면에 뜨는 문구는 기기 쪽(public/sw.js)에 고정돼 있고,
// 서버에서 개인 정보를 실어 보내지 않습니다.
import crypto from 'crypto'

const b64u = (b: Buffer) => b.toString('base64url')

export interface VapidConfig { pub: string; priv: string; subject: string }

export function vapidConfig(): VapidConfig | null {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return null
  return { pub, priv, subject: process.env.VAPID_SUBJECT || 'https://sgrh-health.vercel.app' }
}

// 브라우저 회사의 푸시 서버만 허용 — 직원이 보낸 주소로 서버가 아무 곳에나 요청하지 않게 함
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.apple\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/]
export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false
  try {
    const u = new URL(endpoint)
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname))
  } catch {
    return false
  }
}

function vapidToken(audience: string, cfg: VapidConfig): string {
  const pub = Buffer.from(cfg.pub, 'base64url') // 65바이트: 0x04 | x | y
  const key = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: cfg.priv, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: 'jwk',
  })
  const head = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = b64u(Buffer.from(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: cfg.subject })))
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' })
  return `${head}.${body}.${b64u(sig)}`
}

/** 'ok' 보냄 · 'gone' 기기가 구독을 끊음(주소 삭제 대상) · 'error' 그 밖의 실패 */
export async function sendPush(endpoint: string, cfg: VapidConfig): Promise<'ok' | 'gone' | 'error'> {
  if (!isPushEndpoint(endpoint)) return 'gone'
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${vapidToken(new URL(endpoint).origin, cfg)}, k=${cfg.pub}`,
        TTL: '3600',
        Urgency: 'high',
        'Content-Length': '0',
      },
    })
    if (res.status === 404 || res.status === 410) return 'gone'
    return res.ok ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

/** 한 직원의 모든 기기로 보내고, 끊긴 주소는 지웁니다. 보낸 기기 수를 돌려줍니다. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pushToEndpoints(db: any, endpoints: string[], cfg: VapidConfig): Promise<number> {
  const results = await Promise.all(endpoints.map(async (e) => ({ e, r: await sendPush(e, cfg) })))
  const gone = results.filter((x) => x.r === 'gone').map((x) => x.e)
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone)
  return results.filter((x) => x.r === 'ok').length
}

/** 031 적용 전 DB(표 없음)인지 */
export function isMissingTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205')
}
