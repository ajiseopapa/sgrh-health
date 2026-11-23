// 화면 → 서버 API 호출. CSRF 방어용 전용 헤더를 항상 붙입니다.
export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean
  status: number
  message: string
  data: T & { needLogin?: boolean; mustChangePin?: boolean; needAdmin?: boolean }
}

export async function api<T = Record<string, unknown>>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown } = {}
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'x-sgrh-request': '1',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    return {
      ok: res.ok && json.ok !== false,
      status: res.status,
      message: json.message ?? (res.ok ? '' : '처리 중 문제가 생겼어요.'),
      data: json,
    }
  } catch {
    return { ok: false, status: 0, message: '인터넷 연결을 확인해주세요.', data: {} as ApiResult<T>['data'] }
  }
}

export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `r-${Math.random().toString(36).slice(2)}-${Date.now()}`
}
