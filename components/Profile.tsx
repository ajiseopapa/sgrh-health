'use client'

// 내 프로필 — 홈 상단 원형 + 이름, 누르면 이모지 고르기(바텀시트)
// 저장은 기존 /api/me/game/profile(nameEmoji) 그대로. 고른 이모지는 피드 프로필 원형에도 같이 쓰입니다.
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { NAME_EMOJIS } from '@/lib/game'
import { Notice } from '@/lib/ui'
import SproutIcon from './SproutIcon'

/** 프로필 원형. 이모지를 고르지 않았으면 기본 아이콘(움트다 새싹) */
export function ProfileAvatar({ emoji, size = 44 }: { emoji: string | null; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full border-2 border-ink-900 bg-sheet"
      style={{ width: size, height: size }} aria-hidden="true">
      {emoji
        ? <span className="leading-none" style={{ fontSize: Math.round(size * 0.55) }}>{emoji}</span>
        : <SproutIcon size={Math.round(size * 0.6)} />}
    </span>
  )
}

/** 이모지 고르기 바텀시트. 누르면 바로 저장하고 닫힘 */
export function ProfileSheet({ open, current, onClose, onSaved }: {
  open: boolean; current: string | null; onClose: () => void; onSaved: (v: string | null) => void
}) {
  const [saving, setSaving] = useState<string | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { if (open) setErr('') }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null

  async function pick(v: string | null) {
    if (saving) return
    if (v === current) return onClose()
    setSaving(v ?? 'none'); setErr('')
    const r = await api('/api/me/game/profile', { method: 'PUT', body: { nameEmoji: v } })
    setSaving(null)
    if (r.ok) { onSaved(v); onClose() } else setErr(r.message || '저장하지 못했어요.')
  }
  const cell = (on: boolean) =>
    `flex h-[44px] items-center justify-center rounded-xl border-2 leading-none disabled:opacity-50 ${on ? 'border-ink-900 bg-brand-300' : 'border-line bg-sheet'}`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/45 lg:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="profile-sheet-title"
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-paper lg:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 id="profile-sheet-title" className="text-[17px] font-extrabold text-ink-900">프로필 이모지</h2>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="-mr-2 flex h-11 w-11 items-center justify-center text-[24px] leading-none text-ink-500">×</button>
        </div>
        <div className="overflow-y-auto px-5 pb-6">
          <p className="text-[13px] text-ink-500">고르면 홈과 피드의 내 프로필에 바로 보여요. 이모지 모양은 휴대폰마다 조금 다를 수 있어요.</p>
          <div className="mt-3 grid grid-cols-6 gap-2" role="radiogroup" aria-label="프로필 이모지">
            {NAME_EMOJIS.map((e) => (
              <button key={e} type="button" role="radio" aria-checked={current === e} aria-label={e}
                disabled={!!saving} onClick={() => pick(e)} className={`text-[22px] ${cell(current === e)}`}>{e}</button>
            ))}
          </div>
          <button type="button" role="radio" aria-checked={current === null} disabled={!!saving} onClick={() => pick(null)}
            className={`mt-2 w-full text-[14px] font-bold text-ink-900 ${cell(current === null)}`}>
            기본 아이콘
          </button>
          {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
        </div>
      </div>
    </div>
  )
}

/** 홈 상단: 프로필 원형 + 이름(본인 확인된 직원만). 누르면 바텀시트 */
export function HomeProfile({ name }: { name: string }) {
  const [emoji, setEmoji] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    api<{ nameEmoji?: string | null }>('/api/me/game').then((r) => { if (r.ok) setEmoji(r.data.nameEmoji ?? null) })
  }, [])
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${name}님 프로필 이모지 바꾸기`}
        className="-ml-1 flex min-h-[44px] items-center gap-2.5 rounded-full py-1 pl-1 pr-3 active:bg-ink-900/5">
        <ProfileAvatar emoji={emoji} size={40} />
        <span className="text-[15px] font-bold text-ink-900">{name}님</span>
      </button>
      <ProfileSheet open={open} current={emoji} onClose={() => setOpen(false)} onSaved={setEmoji} />
    </>
  )
}
