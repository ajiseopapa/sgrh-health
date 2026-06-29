'use client'

import { useState } from 'react'
import HomeTab from '@/components/HomeTab'
import StatsTab from '@/components/StatsTab'
import FeedTab from '@/components/FeedTab'

type TabKey = 'home' | 'stats' | 'feed'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'home', label: '홈', icon: '🏠' },
  { key: 'stats', label: '통계', icon: '📊' },
  { key: 'feed', label: '피드', icon: '📝' },
]

export default function Page() {
  const [tab, setTab] = useState<TabKey>('home')

  return (
    <div className="flex flex-col min-h-screen pb-16">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3">
        <h1 className="text-lg font-bold">🏋️ 직원 운동 관리</h1>
      </header>

      <main className="flex-1 px-4 py-4">
        {tab === 'home' && <HomeTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'feed' && <FeedTab />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 mx-auto max-w-md bg-white border-t flex">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
              tab === t.key ? 'text-brand-600 font-semibold' : 'text-gray-400'
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="mt-0.5">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
