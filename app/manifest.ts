import type { MetadataRoute } from 'next'

// 홈 화면에 추가(설치)용 정보 — 아이폰은 홈 화면에 추가한 앱에서만 알림을 받을 수 있습니다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '움트다',
    short_name: '움트다',
    description: '세계로병원 직원 건강 프로젝트',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F4EE',
    theme_color: '#F6F4EE',
    lang: 'ko',
    icons: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }],
  }
}
