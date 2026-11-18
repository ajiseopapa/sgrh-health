// 기기 식별자. 응원 중복은 이제 사람(직원) 기준으로 막습니다 (lib/me.ts).
// 이 값은 이름 기준으로 바뀌기 전에 이 기기에서 누른 예전 응원을 알아보는 데만 씁니다.

const LS_KEY = 'sgrh_health_device'

export function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(LS_KEY)
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `d-${Math.random().toString(36).slice(2)}-${Date.now()}`
    localStorage.setItem(LS_KEY, id)
  }
  return id
}
