import type { Metadata, Viewport } from 'next'
import './globals.css'

// 글꼴: Pretendard (한글·영문·숫자 한 벌). 웹폰트 CSS만 불러오고 라이브러리는 추가하지 않음.
const PRETENDARD = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://sgrh-health.vercel.app'),
  title: '직원 운동 관리',
  description: '우리 모두의 건강한 일상을 위한 직원 전용 운동 기록 플랫폼',
  // 카카오톡·세계로톡 등에 링크를 붙였을 때 보이는 미리보기 이미지
  openGraph: {
    type: 'website',
    url: '/',
    siteName: '세계로병원 직원 운동 관리',
    title: '직원 운동 관리 시스템',
    description: '우리 모두의 건강한 일상을 위한 직원 전용 운동 기록 플랫폼',
    locale: 'ko_KR',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: '직원 운동 관리 시스템' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '직원 운동 관리 시스템',
    description: '우리 모두의 건강한 일상을 위한 직원 전용 운동 기록 플랫폼',
    images: ['/og.jpg'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 확대 허용 (접근성: 글씨를 키워 보는 직원을 막지 않음)
  themeColor: '#F4F0E8',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD} />
      </head>
      <body className="bg-paper font-sans text-ink-900 antialiased">
        {/* 휴대폰 폭 기준. 태블릿·PC에서는 가운데 한 줄로 보이고 양옆은 같은 바탕 */}
        <div className="mx-auto min-h-screen max-w-[480px] bg-paper">{children}</div>
      </body>
    </html>
  )
}
