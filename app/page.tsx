'use client'

import { useState } from 'react'
import HomeTab from '@/components/HomeTab'
import StatsTab from '@/components/StatsTab'
import FeedTab from '@/components/FeedTab'
import RecordTab from '@/components/RecordTab'
import SettingsPanel from '@/components/SettingsPanel'
import AdminPasswordModal from '@/components/AdminPasswordModal'
import AnnouncementsModal, { useHasUnreadAnnouncements } from '@/components/AnnouncementsModal'

type TabKey = 'home' | 'stats' | 'feed' | 'record'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'home',   label: '홈',   icon: '🏠' },
  { key: 'stats',  label: '통계', icon: '📊' },
  { key: 'feed',   label: '피드', icon: '📝' },
  { key: 'record', label: '기록', icon: '👤' },
]

export default function Page() {
  const [tab, setTab] = useState<TabKey>('home')
  const [showSettings, setShowSettings] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showAnnouncements, setShowAnnouncements] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const hasUnreadAnnouncements = useHasUnreadAnnouncements()

  function handleSettingsClick() {
    if (isAdmin) {
      setShowSettings(true)
    } else {
      setShowPasswordModal(true)
    }
  }

  function handleLogout() {
    setIsAdmin(false)
    sessionStorage.removeItem('admin_unlocked')
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface pb-20">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-surface/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-base">
            🏋️
          </span>
          <h1 className="text-base font-bold tracking-tight text-ink-900">직원 운동 관리</h1>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                관리자
              </span>
              <button
                onClick={handleLogout}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-400 transition active:bg-ink-100"
              >
                로그아웃
              </button>
            </>
          )}
          <button
            onClick={() => setShowAnnouncements(true)}
            aria-label="업데이트 내역"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-base text-ink-400 transition active:bg-ink-100"
          >
            🔔
            {hasUnreadAnnouncements && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>
          <button
            onClick={handleSettingsClick}
            aria-label="관리 설정"
            className="flex h-9 w-9 items-center justify-center rounded-full text-base text-ink-400 transition active:bg-ink-100"
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        {tab === 'home'   && <HomeTab   key={`home-${refreshKey}`} />}
        {tab === 'stats'  && <StatsTab  key={`stats-${refreshKey}`} />}
        {tab === 'feed'   && <FeedTab   key={`feed-${refreshKey}`} />}
        {tab === 'record' && <RecordTab key={`record-${refreshKey}`} />}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-md gap-1 bg-white/95 px-3 py-2 shadow-nav backdrop-blur"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${
              tab === t.key ? 'text-brand-600' : 'text-ink-300'
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-base transition-colors ${
                tab === t.key ? 'bg-brand-50' : ''
              }`}
            >
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>

      {showPasswordModal && (
        <AdminPasswordModal
          onSuccess={() => {
            setIsAdmin(true)
            sessionStorage.setItem('admin_unlocked', 'true')
            setShowPasswordModal(false)
            setShowSettings(true)
          }}
          onCancel={() => setShowPasswordModal(false)}
        />
      )}

      {showAnnouncements && (
        <AnnouncementsModal
          isOpen={showAnnouncements}
          onClose={() => setShowAnnouncements(false)}
          isAdmin={isAdmin}
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
