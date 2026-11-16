// 움트다 서비스 워커 — 운동 알람(푸시) 표시만 합니다. 화면·자료를 저장(캐시)하지 않습니다.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  // 서버는 내용 없는 신호만 보냅니다. 잠금 화면에 뜨는 문구는 여기 고정.
  e.waitUntil(
    self.registration.showNotification('움트다', {
      body: '운동할 시간이에요. 오늘의 움직임을 기록해 보세요.',
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      tag: 'exercise-reminder',
      renotify: true,
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus()
      return self.clients.openWindow('/')
    }),
  )
})
