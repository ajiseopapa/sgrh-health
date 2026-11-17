'use client'

// 프로필 — 홈 상단 원형 + 이름. 누르면 내 프로필(캐릭터·한마디·이모지) 창이 열립니다.
// 피드에서 동료 이름을 누르면 그 사람의 캐릭터와 한마디가 보입니다(PeerSheet).
// 저장은 /api/me/game/profile 하나로: character · message · nameEmoji · showInFeed
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { CHARACTERS, CharacterKey, characterOf, decorByKey, DEFAULT_CHARACTER, NAME_EMOJIS } from '@/lib/game'
import { Loading, Notice } from '@/lib/ui'
import SproutIcon from './SproutIcon'
import TreeArt from './TreeArt'

const MESSAGE_MAX = 40

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

/** 픽셀 캐릭터 그림. 64×96 원본을 정수배로만 키우고 줄여 픽셀이 뭉개지지 않게 함 */
export function PixelCharacter({ charKey, scale = 2, className = '' }: { charKey: string | null; scale?: number; className?: string }) {
  const c = characterOf(charKey)
  return (
    <img src={c.src} alt={`${c.name} 캐릭터`} width={64 * scale} height={96 * scale}
      className={`shrink-0 ${className}`} style={{ imageRendering: 'pixelated', width: 64 * scale, height: 96 * scale }} />
  )
}

/** 창 껍데기 — 폰은 아래에서 올라오고, PC는 가운데 */
export function Sheet({ title, titleId, onClose, children }: { title: string; titleId: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/45 lg:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-2xl bg-paper lg:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 id={titleId} className="text-[17px] font-extrabold text-ink-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="-mr-2 flex h-11 w-11 items-center justify-center text-[24px] leading-none text-ink-500">×</button>
        </div>
        <div className="overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}

interface MyProfile { nameEmoji: string | null; characterKey: CharacterKey | null; showInFeed: boolean; message: string | null }

/** 내 프로필 창 — 캐릭터 고르기 · 한마디 · 프로필 이모지 · 동료에게 캐릭터 보이기 */
export function ProfileSheet({ open, name, onClose, onEmoji }: {
  open: boolean; name: string; onClose: () => void; onEmoji: (v: string | null) => void
}) {
  const [p, setP] = useState<MyProfile | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    if (!open) return
    setMsg(null)
    api<Partial<MyProfile>>('/api/me/game').then((r) => {
      if (!r.ok) { setMsg({ tone: 'error', text: r.message || '불러오지 못했어요.' }); return }
      const d = { nameEmoji: r.data.nameEmoji ?? null, characterKey: r.data.characterKey ?? null, showInFeed: r.data.showInFeed ?? false, message: r.data.message ?? null }
      setP(d); setDraft(d.message ?? '')
    })
  }, [open])
  if (!open) return null

  /** 한 칸만 저장. 성공하면 화면 값을 바꿉니다 */
  async function save(body: Record<string, unknown>, apply: (cur: MyProfile) => MyProfile, done?: string) {
    if (busy || !p) return
    setBusy(true); setMsg(null)
    const r = await api('/api/me/game/profile', { method: 'PUT', body })
    setBusy(false)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '저장하지 못했어요.' }); return }
    const next = apply(p)
    setP(next); onEmoji(next.nameEmoji)
    if (done) setMsg({ tone: 'success', text: done })
  }

  const cell = (on: boolean) =>
    `flex h-[44px] items-center justify-center rounded-xl border-2 leading-none disabled:opacity-50 ${on ? 'border-ink-900 bg-brand-300' : 'border-line bg-sheet'}`
  const label = 'mb-2 text-[13px] font-bold text-ink-700'

  return (
    <Sheet title="내 프로필" titleId="profile-sheet-title" onClose={onClose}>
      {!p ? (msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : <Loading lines={3} />) : (
        <div className="space-y-6">
          {/* 캐릭터 */}
          <div className="flex items-end gap-5">
            <PixelCharacter charKey={p.characterKey ?? DEFAULT_CHARACTER} scale={2} />
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-[18px] font-extrabold text-ink-900">{p.nameEmoji ? `${p.nameEmoji} ` : ''}{name}</p>
              <p className="mt-1 break-words text-[14px] text-ink-600">{p.message || '아직 한마디가 없어요.'}</p>
            </div>
          </div>

          <div>
            <p className={label}>캐릭터</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="캐릭터 고르기">
              {CHARACTERS.map((c) => {
                const on = (p.characterKey ?? DEFAULT_CHARACTER) === c.key
                return (
                  <button key={c.key} type="button" role="radio" aria-checked={on} disabled={busy}
                    onClick={() => { if (c.key !== p.characterKey) save({ character: c.key }, (cur) => ({ ...cur, characterKey: c.key })) }}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 px-2 py-2 disabled:opacity-50 ${on ? 'border-ink-900 bg-brand-300' : 'border-line bg-sheet'}`}>
                    <PixelCharacter charKey={c.key} scale={0.5} />
                    <span className="text-[14px] font-bold text-ink-900">{c.name}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[12px] text-ink-500">캐릭터를 꾸미는 아이템은 준비 중이에요.</p>
          </div>

          {/* 한마디 */}
          <div>
            <label htmlFor="profile-message" className={`block ${label}`}>한마디</label>
            <div className="flex gap-2">
              <input id="profile-message" value={draft} maxLength={MESSAGE_MAX} onChange={(e) => setDraft(e.target.value)}
                placeholder="예: 이번 달은 주 3회!" className="input-field min-w-0 flex-1" />
              <button type="button" disabled={busy || draft.trim() === (p.message ?? '')}
                onClick={() => save({ message: draft.trim() || null }, (cur) => ({ ...cur, message: draft.trim() || null }), '한마디를 저장했어요.')}
                className="btn-primary w-auto shrink-0 px-5">저장</button>
            </div>
            <p className="mt-1.5 text-[12px] text-ink-500">동료가 피드에서 내 이름을 누르면 보여요. {[...draft].length}/{MESSAGE_MAX}자</p>
          </div>

          {/* 이모지 */}
          <div>
            <p className={label}>프로필 이모지</p>
            <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="프로필 이모지">
              {NAME_EMOJIS.map((e) => (
                <button key={e} type="button" role="radio" aria-checked={p.nameEmoji === e} aria-label={e} disabled={busy}
                  onClick={() => { if (e !== p.nameEmoji) save({ nameEmoji: e }, (cur) => ({ ...cur, nameEmoji: e })) }}
                  className={`text-[22px] ${cell(p.nameEmoji === e)}`}>{e}</button>
              ))}
            </div>
            <button type="button" role="radio" aria-checked={p.nameEmoji === null} disabled={busy}
              onClick={() => { if (p.nameEmoji !== null) save({ nameEmoji: null }, (cur) => ({ ...cur, nameEmoji: null })) }}
              className={`mt-2 w-full text-[14px] font-bold text-ink-900 ${cell(p.nameEmoji === null)}`}>
              기본 아이콘
            </button>
          </div>

          {/* 캐릭터 공개 */}
          <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
            <div>
              <p className="text-[15px] font-bold text-ink-900">동료에게 내 캐릭터·정원 보이기</p>
              <p className="mt-0.5 text-[13px] text-ink-500">켜면 동료가 피드에서 내 이름을 눌렀을 때 캐릭터와 정원이 보여요. 운동한 날 수와 햇빛은 보이지 않아요.</p>
            </div>
            <button type="button" role="switch" aria-checked={p.showInFeed} disabled={busy} aria-label="동료에게 내 캐릭터·정원 보이기"
              onClick={() => save({ showInFeed: !p.showInFeed }, (cur) => ({ ...cur, showInFeed: !cur.showInFeed }))}
              className="flex h-[44px] w-[60px] shrink-0 items-center justify-center disabled:opacity-50">
              <span className={`relative block h-[32px] w-[56px] rounded-full border-2 border-ink-900 transition-colors ${p.showInFeed ? 'bg-brand-300' : 'bg-ink-100'}`}>
                <span className={`absolute top-[2px] h-[24px] w-[24px] rounded-full bg-ink-900 motion-safe:transition-[left] ${p.showInFeed ? 'left-[26px]' : 'left-[2px]'}`} />
              </span>
            </button>
          </div>

          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        </div>
      )}
    </Sheet>
  )
}

interface Peer {
  emoji: string | null; showCharacter: boolean; character: string | null; message: string | null
  garden?: { stage: number; stageName: string; slots: (string | null)[] } | null
}

/** 동료 정원(구경만) — 가운데 나무 + 둘레 8칸. 누를 수 없음 */
function PeerGarden({ name, garden }: { name: string; garden: NonNullable<Peer['garden']> }) {
  const placed = garden.slots.filter(Boolean).length
  return (
    <div className="mt-5 w-full border-t border-line pt-4 text-left">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-bold text-ink-900">{name}님의 정원</p>
        <p className="text-[13px] font-semibold text-ink-500">{garden.stageName}</p>
      </div>
      <div className="mx-auto mt-3 grid max-w-[280px] grid-cols-3 gap-1.5 rounded-2xl bg-brand-50 p-2.5" role="img"
        aria-label={`${name}님의 정원: ${garden.stageName}, 장식 ${placed}개`}>
        {Array.from({ length: 9 }, (_, pos) => {
          if (pos === 4) return <div key="tree" className="flex aspect-square items-center justify-center"><TreeArt stage={garden.stage} size={72} /></div>
          const d = decorByKey(garden.slots[pos < 4 ? pos : pos - 1])
          return (
            <div key={pos} className={`flex aspect-square items-center justify-center rounded-xl text-[32px] leading-none ${d ? 'bg-paper' : 'bg-brand-100/70'}`}>
              {d && <span aria-hidden="true">{d.emoji}</span>}
            </div>
          )
        })}
      </div>
      {placed === 0 && <p className="mt-2 text-center text-[13px] text-ink-500">아직 장식을 놓지 않았어요.</p>}
    </div>
  )
}

/** 동료 프로필 창 — 피드에서 이름·이모지를 눌렀을 때. 캐릭터·정원(본인이 보이기를 켠 경우)과 한마디 */
export function PeerSheet({ employeeId, name, onClose }: { employeeId: string | null; name: string; onClose: () => void }) {
  const [peer, setPeer] = useState<Peer | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!employeeId) return
    setPeer(null); setErr('')
    api<{ profile: Peer }>(`/api/game/profile?id=${employeeId}`).then((r) => {
      if (r.ok) setPeer(r.data.profile); else setErr(r.message || '불러오지 못했어요.')
    })
  }, [employeeId])
  if (!employeeId) return null
  return (
    <Sheet title="프로필" titleId="peer-sheet-title" onClose={onClose}>
      {err ? <Notice tone="error">{err}</Notice> : !peer ? <Loading lines={2} /> : (
        <div className="flex flex-col items-center pb-2 pt-2 text-center">
          {peer.showCharacter
            ? <PixelCharacter charKey={peer.character} scale={2} />
            : <ProfileAvatar emoji={peer.emoji} size={96} />}
          <p className="mt-4 text-[20px] font-extrabold text-ink-900">{peer.showCharacter && peer.emoji ? `${peer.emoji} ` : ''}{name}</p>
          <p className={`mt-3 w-full break-words rounded-xl bg-ink-50 px-4 py-3 text-[15px] ${peer.message ? 'text-ink-900' : 'text-ink-500'}`}>
            {peer.message || '아직 한마디가 없어요.'}
          </p>
          {peer.garden && <PeerGarden name={name} garden={peer.garden} />}
        </div>
      )}
    </Sheet>
  )
}

/** 홈 상단: 프로필 원형 + 이름(본인 확인된 직원만). 누르면 내 프로필 창 */
export function HomeProfile({ name }: { name: string }) {
  const [emoji, setEmoji] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    api<{ nameEmoji?: string | null }>('/api/me/game').then((r) => { if (r.ok) setEmoji(r.data.nameEmoji ?? null) })
  }, [])
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${name}님 프로필 열기`}
        className="-ml-1 flex min-h-[44px] items-center gap-2.5 rounded-full py-1 pl-1 pr-3 active:bg-ink-900/5">
        <ProfileAvatar emoji={emoji} size={40} />
        <span className="text-[15px] font-bold text-ink-900">{name}님</span>
      </button>
      <ProfileSheet open={open} name={name} onClose={() => setOpen(false)} onEmoji={setEmoji} />
    </>
  )
}
