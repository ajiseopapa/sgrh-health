// 응원(칭찬)을 누른 주체를 구분하기 위한 기기 식별자.
// 로그인 없이 누른 응원은 이 값(기기)으로 구분합니다: 같은 기기에서 다시 누르면 취소, 다른 기기는 별개.
// 로그인한 직원의 응원은 서버가 직원 기준으로 세므로 기기가 달라도 1개입니다(035).

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
