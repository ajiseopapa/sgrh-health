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
  title: '직원 운동 관리',
  description: '팀 운동 기록 및 랭킹 트래커',
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
