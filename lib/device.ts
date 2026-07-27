// 응원(칭찬)을 누른 주체를 구분하기 위한 기기 식별자.
// 이름을 묻지 않고 바로 누를 수 있게 하려고, 사람 대신 기기를 기억합니다.
// 같은 기기에서 다시 누르면 취소되고, 다른 기기에서는 별개로 카운트됩니다.

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
