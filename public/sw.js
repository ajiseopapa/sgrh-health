// 움트다 서비스 워커 — 알림(푸시) 표시만 합니다. 화면·자료를 저장(캐시)하지 않습니다.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

const REMINDER = {
  title: '움트다',
  body: '운동할 시간이에요. 오늘의 움직임을 기록해 보세요.',
  tag: 'exercise-reminder',
  url: '/',
}

// 서버는 내용 없는 신호만 보냅니다(개인 정보를 푸시에 싣지 않음).
// 신호가 오면 내 방명록에 방금(3분 안) 새 글이 왔는지 물어보고, 그렇다면 방명록 알림을, 아니면 운동 알람을 띄웁니다.
async function pickNotice() {
  try {
    const res = await fetch('/api/me/guestbook', { credentials: 'same-origin', cache: 'no-store' })
    if (!res.ok) return REMINDER
    const j = await res.json()
    const l = j && j.latest
    if (j && j.unread > 0 && l && Date.now() - new Date(l.createdAt).getTime() < 3 * 60 * 1000) {
      return {
        title: '움트다 · 정원 방명록',
        body: j.unread > 1 ? `${l.name}님 등 동료가 내 정원에 방명록을 남겼어요. (새 글 ${j.unread}개)` : `${l.name}님이 내 정원에 방명록을 남겼어요.`,
        tag: 'guestbook',
        url: '/?tab=garden',
      }
    }
  } catch (_) { /* 물어보지 못하면 운동 알람 문구 */ }
  return REMINDER
}

self.addEventListener('push', (e) => {
  e.waitUntil(
    pickNotice().then((n) =>
      self.registration.showNotification(n.title, {
        body: n.body,
        icon: '/icon-512.png',
        badge: '/icon-512.png',
        tag: n.tag,
        renotify: true,
        data: { url: n.url },
      }),
    ),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('navigate' in c && url !== '/') return c.navigate(url).then((w) => (w || c).focus()).catch(() => c.focus())
        if ('focus' in c) return c.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
