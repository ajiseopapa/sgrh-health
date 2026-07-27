// "나는 누구인가" — 응원(칭찬)을 누를 때 쓰는 최소한의 신원 정보.
// 이 앱에는 로그인이 없어서, 처음 응원할 때 한 번만 이름을 고르고 브라우저에 기억시킵니다.

const LS_KEY = 'sgrh_health_me'

export interface Me {
  id: string
  name: string
}

export function getMe(): Me | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Me>
    if (!parsed?.id || !parsed?.name) return null
    return { id: parsed.id, name: parsed.name }
  } catch {
    return null
  }
}

export function setMe(me: Me): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(me))
}

export function clearMe(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LS_KEY)
}
