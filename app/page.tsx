'use client'

import { useState } from 'react'
import HomeTab from '@/components/HomeTab'
import FeedTab from '@/components/FeedTab'
import RecordTab from '@/components/RecordTab'
import ChallengeTab from '@/components/ChallengeTab'
import SettingsPanel from '@/components/SettingsPanel'
import AdminPasswordModal from '@/components/AdminPasswordModal'
import AnnouncementsModal, { useHasUnreadAnnouncements } from '@/components/AnnouncementsModal'
import SuggestionModal, { useHasNewSuggestions } from '@/components/SuggestionModal'
import IdentityModal from '@/components/IdentityModal'
import { MeProvider, useMe } from '@/lib/me'
import { DialogProvider } from '@/lib/dialog'
import { Icon } from '@/lib/ui'

// 직원 화면은 네 개만. 관리 기능은 위쪽 '관리'에서 따로 엽니다.
export type TabKey = 'home' | 'record' | 'challenge' | 'feed'

const TABS: { key: TabKey; label: string; icon: 'home' | 'pencil' | 'flag' | 'feed' }[] = [
  { key: 'home', label: '홈', icon: 'home' },
  { key: 'record', label: '기록', icon: 'pencil' },
  { key: 'challenge', label: '도전', icon: 'flag' },
  { key: 'feed', label: '피드', icon: 'feed' },
]

export default function Page() {
  return (
    <MeProvider>
      <DialogProvider>
        <AppShell />
      </DialogProvider>
    </MeProvider>
  )
}

function AppShell() {
  const { isAdmin, refresh, adminLogout } = useMe()
  const [tab, setTab] = useState<TabKey>('home')
  const [showSettings, setShowSettings] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showAnnouncements, setShowAnnouncements] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const hasUnreadAnnouncements = useHasUnreadAnnouncements()
  const hasNewSuggestions = useHasNewSuggestions(isAdmin)

  function handleSettingsClick() {
    if (isAdmin) {
      setShowSettings(true)
    } else {
      setShowPasswordModal(true)
    }
  }

  // 관리자 여부는 서버의 관리자 세션(8시간)이 기준입니다
  async function handleLogout() {
    setShowSettings(false)
    await adminLogout()
  }

  function HeadButton({ label, icon, dot, onClick }: { label: string; icon: 'bell' | 'chat' | 'gear'; dot?: boolean; onClick: () => void }) {
    return (
      <button onClick={onClick} aria-label={label}
        className="relative flex h-11 w-11 items-center justify-center rounded-lg text-ink-700 transition active:bg-ink-50">
        <Icon name={icon} size={21} />
        {dot && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-600" aria-hidden="true" />}
        {dot && <span className="sr-only">(새 소식)</span>}
      </button>
    )
  }

  return (
    <>
      <div className="flex min-h-screen flex-col bg-paper pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-paper/95 px-5 pb-2 pt-3 backdrop-blur">
        <p className="text-[17px] font-extrabold tracking-[-0.02em] text-ink-900">
          직원 운동<span className="text-brand-600">.</span>
        </p>
        <div className="-mr-2 flex items-center">
          {isAdmin && (
            <button onClick={handleLogout} className="mr-1 min-h-[44px] px-2 text-[13px] font-semibold text-ink-500">
              관리자 로그아웃
            </button>
          )}
          <HeadButton label="공지" icon="bell" dot={hasUnreadAnnouncements} onClick={() => setShowAnnouncements(true)} />
          <HeadButton label="건의함" icon="chat" dot={hasNewSuggestions} onClick={() => setShowSuggestions(true)} />
          <HeadButton label={isAdmin ? '관리 설정' : '관리자'} icon="gear" onClick={handleSettingsClick} />
        </div>
      </header>

      <main className="flex-1 px-5">
        {tab === 'home'      && <HomeTab      key={`home-${refreshKey}`} onRecord={() => setTab('record')} onChallenge={() => setTab('challenge')} />}
        {tab === 'record'    && <RecordTab    key={`record-${refreshKey}`} />}
        {tab === 'challenge' && <ChallengeTab key={`challenge-${refreshKey}`} />}
        {tab === 'feed'      && <FeedTab      key={`feed-${refreshKey}`} />}
      </main>

      <nav aria-label="주 메뉴"
        className="fixed bottom-0 left-0 right-0 z-20 mx-auto flex max-w-[480px] border-t border-line bg-paper/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map((t) => {
          const on = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)} aria-current={on ? 'page' : undefined} aria-label={t.label}
              className={`flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[12px] font-bold transition-colors ${
                on ? 'text-ink-900' : 'text-ink-400'
              }`}>
              <Icon name={t.icon} size={22} />
              <span aria-hidden="true">{t.label}</span>
              <span className={`h-[3px] w-5 rounded-full ${on ? 'bg-brand-600' : 'bg-transparent'}`} aria-hidden="true" />
            </button>
          )
        })}
      </nav>

      {showPasswordModal && (
        <AdminPasswordModal
          onSuccess={async () => {
            await refresh()
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

      {showSuggestions && (
        <SuggestionModal
          isOpen={showSuggestions}
          onClose={() => setShowSuggestions(false)}
          isAdmin={isAdmin}
        />
      )}

      <IdentityModal />

      {showSettings && (
        <SettingsPanel
          onClose={() => {
            setShowSettings(false)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}
    </div>
    </>
  )
}
