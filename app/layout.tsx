import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

// 영문/숫자는 Plus Jakarta Sans, 한글은 자동으로 시스템 폰트로 폴백됩니다.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
})

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
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={jakarta.variable}>
      <body className="bg-surface font-sans text-ink-900 antialiased">
        {/* max-w-md로 모바일 폭에 고정, 데스크탑에서 봐도 깨지지 않게 가운데 정렬 */}
        <div className="mx-auto min-h-screen max-w-md bg-surface">{children}</div>
      </body>
    </html>
  )
}
