'use client'

// 프로필 — 홈 상단 원형 + 이름. 누르면 내 프로필(캐릭터·한마디·이모지) 창이 열립니다.
// 피드에서 동료 이름을 누르면 그 사람의 캐릭터와 한마디가 보입니다(PeerSheet).
// 저장은 /api/me/game/profile 하나로: character · message · nameEmoji · showInFeed
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useMe } from '@/lib/me'
import { CHARACTERS, CharacterKey, characterOf, characterSrc, DEFAULT_CHARACTER, Equipped, NAME_EMOJIS, Placed } from '@/lib/game'
import { Loading, Notice } from '@/lib/ui'
import SproutIcon from './SproutIcon'
import GardenCanvas from './GardenCanvas'
import CharacterFigure from './CharacterFigure'
import Guestbook from './Guestbook'

const MESSAGE_MAX = 40

/** 프로필 원형. 이모지를 고르지 않았으면 기본 아이콘(움트다 새싹) */
export function ProfileAvatar({ emoji, size = 44 }: { emoji: string | null | undefined; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full border-2 border-ink-900 bg-sheet"
      style={{ width: size, height: size }} aria-hidden="true">
      {/* undefined = 아직 모름(불러오는 중): 비워 둠. 새싹을 먼저 그렸다가 이모지로 바뀌면 깜빡여 보임 */}
      {emoji === undefined ? null : emoji
        ? <span className="leading-none" style={{ fontSize: Math.round(size * 0.55) }}>{emoji}</span>
        : <SproutIcon size={Math.round(size * 0.6)} />}
    </span>
  )
}

/** 픽셀 캐릭터 그림. 64×96 원본을 정수배로만 키우고 줄여 픽셀이 뭉개지지 않게 함 */
export function PixelCharacter({ charKey, outfit, equipped, scale = 2, className = '' }: { charKey: string | null; outfit?: string | null; equipped?: Equipped | null; scale?: number; className?: string }) {
  const c = characterOf(charKey)
  if (equipped && Object.values(equipped).some(Boolean)) return <CharacterFigure charKey={charKey} outfit={outfit} equipped={equipped} width={64 * scale} className={className} />
  return (
    <img src={characterSrc(charKey)} alt={`${c.name} 캐릭터`} width={64 * scale} height={96 * scale}
      className={`shrink-0 ${className}`} style={{ width: 64 * scale, height: 96 * scale }} />
  )
}

/** 창 껍데기 — 폰은 아래에서 올라오고, PC는 가운데 */
export function Sheet({ title, titleId, onClose, locked = false, children }: { title: string; titleId: string; onClose: () => void; locked?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !locked) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, locked])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/45 lg:items-center" onClick={locked ? undefined : onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-2xl bg-paper lg:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 id={titleId} className="text-[17px] font-extrabold text-ink-900">{title}</h2>
          {locked ? <span className="h-11" /> : (
            <button type="button" onClick={onClose} aria-label="닫기"
              className="-mr-2 flex h-11 w-11 items-center justify-center text-[24px] leading-none text-ink-500">×</button>
          )}
        </div>
        <div className="overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}

interface MyProfile { nameEmoji: string | null; characterKey: CharacterKey | null; outfitKey: string | null; equipped: Equipped; showInFeed: boolean; message: string | null }

/** 내 프로필 창 — 캐릭터 고르기 · 한마디 · 프로필 이모지 · 동료에게 캐릭터 보이기
 *  setup: 처음 접속해 캐릭터를 아직 안 고른 직원(11-18 TK). 캐릭터를 골라야 닫을 수 있고, 나머지는 나중에 바꿔도 됨 */
export function ProfileSheet({ open, name, onClose, onEmoji, setup = false }: {
  open: boolean; name: string; onClose: () => void; onEmoji: (v: string | null) => void; setup?: boolean
}) {
  if (!open) return null
  return (
    <Sheet title={setup ? '내 캐릭터 고르기' : '내 프로필'} titleId="profile-sheet-title" onClose={onClose} locked={setup}>
      <ProfileEditor name={name} onEmoji={onEmoji} setup={setup} onClose={onClose} />
    </Sheet>
  )
}

/** 내 프로필 고치기(캐릭터·한마디·이모지). 창(ProfileSheet)과 프로필 탭(inline, 11-20 TK)에서 같이 씀.
 *  inline: 프로필 탭 — 큰 캐릭터 그림은 아래 캐릭터 꾸미기 미리보기가 대신함. onSaved: 저장 뒤 탭의 다른 칸을 새로 읽게 */
export function ProfileEditor({ name, onEmoji, setup = false, inline = false, onClose, onSaved }: {
  name: string; onEmoji: (v: string | null) => void; setup?: boolean; inline?: boolean; onClose?: () => void; onSaved?: () => void
}) {
  const [p, setP] = useState<MyProfile | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  // at: 안내를 어느 칸 아래에 보여 줄지(의상·캐릭터를 누르고 생긴 오류가 창 맨 아래에 떠서 '안 눌린다'고 느껴졌음, 11-19 TK)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string; at?: 'look' } | null>(null)

  useEffect(() => {
    setMsg(null)
    api<Partial<MyProfile> & { character?: { equipped?: Equipped } }>('/api/me/game').then((r) => {
      if (!r.ok) { setMsg({ tone: 'error', text: r.message || '불러오지 못했어요.' }); return }
      const d = { nameEmoji: r.data.nameEmoji ?? null, characterKey: r.data.characterKey ?? null, outfitKey: r.data.outfitKey ?? null, equipped: r.data.character?.equipped ?? {}, showInFeed: r.data.showInFeed ?? false, message: r.data.message ?? null }
      setP(d); setDraft(d.message ?? '')
    })
  }, [])

  /** 한 칸만 저장. 성공하면 화면 값을 바꿉니다 */
  async function save(body: Record<string, unknown>, apply: (cur: MyProfile) => MyProfile, done?: string) {
    if (busy || !p) return
    setBusy(true); setMsg(null)
    const r = await api('/api/me/game/profile', { method: 'PUT', body })
    setBusy(false)
    const at = 'outfit' in body || 'character' in body ? 'look' as const : undefined
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '저장하지 못했어요.', at }); return }
    const next = apply(p)
    setP(next); onEmoji(next.nameEmoji); onSaved?.()
    if (done) setMsg({ tone: 'success', text: done, at })
  }

  const cell = (on: boolean) =>
    `flex h-[44px] items-center justify-center rounded-xl border-2 leading-none disabled:opacity-50 ${on ? 'border-ink-900 bg-brand-300' : 'border-line bg-sheet'}`
  const label = 'mb-2 text-[13px] font-bold text-ink-700'

  return (
    <>
      {!p ? (msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : <Loading lines={3} />) : (
        <div className="space-y-6">
          {setup && (
            <p className="rounded-xl bg-brand-50 px-4 py-3 text-[14px] leading-relaxed text-ink-900">
              {name}님, 반가워요. 시작하기 전에 <span className="font-bold">내 캐릭터</span>를 골라 주세요. 한마디와 이모지는 나중에 바꿔도 돼요.
            </p>
          )}
          {/* 캐릭터 */}
          <div className="flex items-end gap-5">
            {/* 처음 접속해 아직 안 골랐으면 큰 그림을 비워 둠(기본 캐릭터가 고른 것처럼 보이지 않게) */}
            {!inline && (!setup || p.characterKey) && <PixelCharacter charKey={p.characterKey ?? DEFAULT_CHARACTER} outfit={p.outfitKey} equipped={p.equipped} scale={2} />}
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-[18px] font-extrabold text-ink-900">{p.nameEmoji ? `${p.nameEmoji} ` : ''}{name}</p>
              <p className="mt-1 break-words text-[14px] text-ink-600">{p.message || '아직 한마디가 없어요.'}</p>
            </div>
          </div>

          <div>
            <p className={label}>캐릭터</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="캐릭터 고르기">
              {CHARACTERS.map((c) => {
                const on = (setup ? p.characterKey : p.characterKey ?? DEFAULT_CHARACTER) === c.key // 처음에는 아무것도 안 골라진 상태
                return (
                  <button key={c.key} type="button" role="radio" aria-checked={on} disabled={busy}
                    onClick={() => { if (c.key !== p.characterKey) save({ character: c.key }, (cur) => ({ ...cur, characterKey: c.key })) }}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 px-2 py-2 disabled:opacity-50 ${on ? 'border-ink-900 bg-brand-300' : 'border-line bg-sheet'}`}>
                    <PixelCharacter charKey={c.key} outfit={p.outfitKey} scale={0.5} />
                    <span className="text-[14px] font-bold text-ink-900">{c.name}</span>
                  </button>
                )
              })}
            </div>
            {setup && !p.characterKey && <p className="mt-2 text-[13px] font-semibold text-ink-900">둘 중 하나를 눌러 주세요.</p>}
          </div>

          {/* 옷·꾸미기는 프로필 탭 › 캐릭터 꾸미기에서(11-20 TK: 운동복 말고 다른 옷은 햇빛으로 삼) */}
          <div className={p.characterKey || !setup ? '' : 'hidden'}>
            {msg && msg.at === 'look' && <div className="mb-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
            {!inline && <p className="text-[13px] text-ink-500">유니폼은 <span className="font-bold text-ink-700">프로필 탭</span>에서 햇빛으로 사서 입어요.</p>}
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
            <div className={`grid grid-cols-6 gap-2 ${inline ? 'lg:grid-cols-12' : ''}`} role="radiogroup" aria-label="프로필 이모지">
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

          {msg && msg.at !== 'look' && <Notice tone={msg.tone}>{msg.text}</Notice>}
          {setup && (
            <button type="button" disabled={busy || !p.characterKey} onClick={() => onClose?.()}
              className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-ink-900 text-[16px] font-bold text-paper active:bg-ink-700 disabled:bg-ink-300">
              {p.characterKey ? '시작하기' : '캐릭터를 골라 주세요'}
            </button>
          )}
        </div>
      )}
    </>
  )
}

interface Peer {
  emoji: string | null; showCharacter: boolean; character: string | null; outfit?: string | null; equipped?: Equipped; message: string | null
  garden?: { stage: number; stageName: string; items: Placed[] } | null
}

/** 동료 정원(구경만) — 나무와 놓인 장식. 누를 수 없음 */
function PeerGarden({ name, garden, character, outfit, equipped }: { name: string; garden: NonNullable<Peer['garden']>; character: string | null; outfit?: string | null; equipped?: Equipped }) {
  const placed = garden.items.length
  return (
    <div className="mt-5 w-full border-t border-line pt-4 text-left">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-bold text-ink-900">{name}님의 정원</p>
        <p className="text-[13px] font-semibold text-ink-500">{garden.stageName}</p>
      </div>
      <div className="mt-3">
        <GardenCanvas stage={garden.stage} items={garden.items} scale={3} character={character} outfit={outfit} equipped={equipped} label={`${name}님의 정원: ${garden.stageName}, 장식 ${placed}개`} />
      </div>
      {placed === 0 && <p className="mt-2 text-center text-[13px] text-ink-500">아직 장식을 놓지 않았어요.</p>}
    </div>
  )
}

/** 동료 프로필 창 — 피드에서 이름·이모지를 눌렀을 때. 캐릭터·한마디·정원과 방명록 */
export function PeerSheet({ employeeId, name, onClose }: { employeeId: string | null; name: string; onClose: () => void }) {
  const { me } = useMe()
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
            ? <PixelCharacter charKey={peer.character} outfit={peer.outfit} equipped={peer.equipped} scale={2} />
            : <ProfileAvatar emoji={peer.emoji} size={96} />}
          <p className="mt-4 text-[20px] font-extrabold text-ink-900">{peer.showCharacter && peer.emoji ? `${peer.emoji} ` : ''}{name}</p>
          <p className={`mt-3 w-full break-words rounded-xl bg-ink-50 px-4 py-3 text-[15px] ${peer.message ? 'text-ink-900' : 'text-ink-500'}`}>
            {peer.message || '아직 한마디가 없어요.'}
          </p>
          {peer.garden && <PeerGarden name={name} garden={peer.garden} character={peer.character} outfit={peer.outfit} equipped={peer.equipped} />}
          <Guestbook ownerId={employeeId} ownerName={name} mine={me?.id === employeeId} />
        </div>
      )}
    </Sheet>
  )
}

export const EMOJI_KEY = 'sgrh_health_my_emoji'

/** 홈 상단: 프로필 원형 + 이름(본인 확인된 직원만). 누르면 내 프로필 창 */
/** onOpen 이 있으면 누를 때 프로필 탭으로 감(11-20 TK). 없으면 예전처럼 창 */
export function HomeProfile({ name, onOpen }: { name: string; onOpen?: () => void }) {
  // 지난번에 본 이모지를 먼저 그리고(이 기기에 기억), 서버 값이 오면 맞춥니다 → 새로고침 때 새싹이 잠깐 보이던 깜빡임 없앰
  const [emoji, setEmojiState] = useState<string | null | undefined>(() => {
    try { const v = localStorage.getItem(EMOJI_KEY); return v === null ? undefined : v || null } catch { return undefined }
  })
  const setEmoji = (v: string | null) => {
    setEmojiState(v)
    try { localStorage.setItem(EMOJI_KEY, v ?? '') } catch { /* 저장 못 해도 화면은 그대로 */ }
  }
  const [open, setOpen] = useState(false)
  useEffect(() => {
    api<{ nameEmoji?: string | null }>('/api/me/game').then((r) => { if (r.ok) setEmoji(r.data.nameEmoji ?? null) })
  }, [])
  return (
    <>
      <button type="button" onClick={() => (onOpen ? onOpen() : setOpen(true))} aria-label={`${name}님 프로필 열기`}
        className="-ml-1 flex min-h-[44px] items-center gap-2.5 rounded-full py-1 pl-1 pr-3 active:bg-ink-900/5">
        <ProfileAvatar emoji={emoji} size={40} />
        <span className="text-[15px] font-bold text-ink-900">{name}님</span>
      </button>
      <ProfileSheet open={open} name={name} onClose={() => setOpen(false)} onEmoji={setEmoji} />
    </>
  )
}

/**
 * 처음 시작하는 직원은 캐릭터(남성형·여성형)를 반드시 고릅니다(11-19 TK).
 * 본인 확인이 끝난 직원이 캐릭터를 아직 안 골랐으면, 어느 탭에 있든 고르기 창을 띄우고 골라야 닫힙니다.
 * 임시 PIN 상태(내 PIN으로 바꾸기 전)에는 띄우지 않습니다 — PIN부터 정해야 저장할 수 있음.
 */
export function CharacterSetupGate({ employeeId, name, onDone }: { employeeId: string | null; name: string; onDone?: () => void }) {
  const [need, setNeed] = useState(false)
  useEffect(() => {
    setNeed(false)
    if (!employeeId) return
    let alive = true
    api<{ characterKey?: string | null }>('/api/me/game').then((r) => { if (alive && r.ok && r.data.characterKey === null) setNeed(true) })
    return () => { alive = false }
  }, [employeeId])
  if (!need) return null
  return <ProfileSheet open name={name} setup onClose={() => { setNeed(false); onDone?.() }} onEmoji={() => {}} />
}
