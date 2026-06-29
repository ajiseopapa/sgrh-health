'use client'

import { useState } from 'react'
import HomeTab from '@/components/HomeTab'
import StatsTab from '@/components/StatsTab'
import FeedTab from '@/components/FeedTab'
import SettingsPanel from '@/components/SettingsPanel'
import AdminPasswordModal from '@/components/AdminPasswordModal'

type TabKey = 'home' | 'stats' | 'feed'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'home', label: '홈', icon: '🏠' },
  { key: 'stats', label: '통계', icon: '📊' },
  { key: 'feed', label: '피드', icon: '📝' },
]

export default function Page() {
  const [tab, setTab] = useState<TabKey>('home')
  const [showSettings, setShowSettings] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  // 설정에서 변경한 내용을 탭에 반영하기 위한 강제 리마운트용 키
  const [refreshKey, setRefreshKey] = useState(0)

  function handleSettingsClick() {
    // 같은 브라우저 탭에서 이미 인증했으면 다시 묻지 않음 (탭 닫으면 초기화됨)
    if (typeof window !== 'undefined' && sessionStorage.getItem('admin_unlocked') === 'true') {
      setShowSettings(true)
    } else {
      setShowPasswordModal(true)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-16">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">🏋️ 직원 운동 관리</h1>
        <button
          onClick={handleSettingsClick}
          aria-label="관리 설정"
          className="text-xl leading-none text-gray-400 active:text-gray-600"
        >
          ⚙️
        </button>
      </header>

      <main className="flex-1 px-4 py-4">
        {tab === 'home' && <HomeTab key={`home-${refreshKey}`} isAdmin={isAdmin} />}
        {tab === 'stats' && <StatsTab key={`stats-${refreshKey}`} />}
        {tab === 'feed' && <FeedTab key={`feed-${refreshKey}`} />}
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

      {showPasswordModal && (
        <AdminPasswordModal
          onSuccess={() => {
            setShowPasswordModal(false)
            setIsAdmin(true)
            setShowSettings(true)
          }}
          onCancel={() => setShowPasswordModal(false)}
        />
      )}

      {showSettings && (
        <SettingsPanel
          onClose={() => {
            setShowSettings(false)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}
