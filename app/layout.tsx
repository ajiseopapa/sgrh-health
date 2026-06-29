import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '직원 운동 관리',
  description: '팀 운동 기록 및 랭킹 트래커',
  // 아래 추가
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏋️</text></svg>",
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
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900">
        {/* max-w-md로 모바일 폭에 고정, 데스크탑에서 봐도 깨지지 않게 가운데 정렬 */}
        <div className="mx-auto max-w-md min-h-screen bg-white shadow-sm">{children}</div>
      </body>
    </html>
  )
}
