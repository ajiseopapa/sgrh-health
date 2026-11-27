'use client'

// 정원 방명록 — 동료 정원(피드 › 이름 › 프로필 창)에서 글을 남기고, 내 정원 탭에서 받은 글을 봅니다.
// 읽기·쓰기 모두 본인 확인한 직원만. 지우기는 쓴 사람·정원 주인(서버가 판단, canDelete).
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useMe } from '@/lib/me'
import { useDialog } from '@/lib/dialog'
import { Loading, Notice } from '@/lib/ui'
import { ProfileAvatar } from './Profile'

const BODY_MAX = 100

interface Entry {
  id: string; body: string; createdAt: string
  author: { id: string; name: string; emoji: string | null }
  mine: boolean; canDelete: boolean
}

/** '방금' · '12분 전' · '3시간 전' · 같은 해면 '11월 27일' · 다른 해면 '2025년 11월 27일' */
function when(iso: string): string {
  const t = new Date(iso).getTime()
  const min = Math.floor((Date.now() - t) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전`
  const opt: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }
  const sameYear = new Date(t).getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat('ko-KR', sameYear ? opt : { ...opt, year: 'numeric' }).format(new Date(t))
}

/** ownerId: 정원 주인. mine: 내 정원(쓰기 칸 대신 받은 글만 보여 줌) */
export default function Guestbook({ ownerId, ownerName, mine = false }: { ownerId: string; ownerName: string; mine?: boolean }) {
  const { me, mustChangePin, loaded, requireMe } = useMe()
  const dialog = useDialog()
  const ready = loaded && !!me && !mustChangePin
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [notReady, setNotReady] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!ready) return
    const r = await api<{ ready: boolean; entries: Entry[] }>(`/api/game/guestbook?id=${ownerId}`)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '방명록을 불러오지 못했어요.' }); setEntries([]); return }
    setNotReady(!r.data.ready)
    setEntries(r.data.entries)
  }, [ownerId, ready])
  useEffect(() => { setEntries(null); setMsg(null); load() }, [load])

  async function write() {
    const text = draft.replace(/\s+/g, ' ').trim()
    if (!text || busy) return
    setBusy(true); setMsg(null)
    const r = await api('/api/game/guestbook', { method: 'POST', body: { ownerId, body: text } })
    setBusy(false)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '남기지 못했어요.' }); return }
    setDraft('')
    await load()
  }

  async function remove(e: Entry) {
    const ok = await dialog.confirm({ title: '이 글을 지울까요?', message: e.mine ? undefined : `${e.author.name}님이 남긴 글이에요. 지우면 되돌릴 수 없어요.`, tone: 'danger', confirmText: '지우기' })
    if (!ok) return
    setBusy(true); setMsg(null)
    const r = await api('/api/game/guestbook', { method: 'DELETE', body: { id: e.id } })
    setBusy(false)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '지우지 못했어요.' }); return }
    setEntries((cur) => (cur ?? []).filter((x) => x.id !== e.id))
  }

  const len = [...draft].length
  return (
    <section className="mt-5 w-full border-t border-line pt-4 text-left" aria-labelledby={`guestbook-${ownerId}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`guestbook-${ownerId}`} className="text-[15px] font-bold text-ink-900">{mine ? '내 정원 방명록' : '방명록'}</h3>
        {entries && entries.length > 0 && <p className="text-[13px] font-semibold text-ink-500">{entries.length >= 50 ? '최근 50개' : `${entries.length}개`}</p>}
      </div>

      {loaded && !ready ? (
        <div className="mt-3">
          <p className="text-[14px] text-ink-600">본인 확인을 하면 방명록을 보고 남길 수 있어요.</p>
          <button type="button" onClick={() => requireMe()} className="btn-secondary mt-3 w-full">본인 확인하기</button>
        </div>
      ) : notReady ? (
        <p className="mt-3 text-[14px] text-ink-500">방명록은 준비 중이에요.</p>
      ) : (
        <>
          {!mine && (
            <div className="mt-3">
              <label htmlFor={`guestbook-input-${ownerId}`} className="sr-only">{ownerName}님 정원에 글 남기기</label>
              <div className="flex gap-2">
                <input id={`guestbook-input-${ownerId}`} value={draft} maxLength={BODY_MAX} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); write() } }}
                  placeholder={`${ownerName}님 정원에 한마디 남기기`} className="input-field min-w-0 flex-1" />
                <button type="button" disabled={busy || !draft.trim()} onClick={write} className="btn-primary w-auto shrink-0 px-5">남기기</button>
              </div>
              {len > 80 && <p className="mt-1.5 text-right text-[12px] text-ink-500">{len}/{BODY_MAX}자</p>}
            </div>
          )}
          {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
          {!entries ? <div className="mt-3"><Loading lines={2} /></div> : entries.length === 0 ? (
            <p className="mt-3 text-[14px] text-ink-500">{mine ? '아직 받은 글이 없어요. 동료가 내 정원에 놀러 오면 여기에 남겨요.' : '첫 글을 남겨 보세요.'}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {entries.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <ProfileAvatar emoji={e.author.emoji} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[14px] font-bold text-ink-900">{e.author.name}</span>
                      <span className="text-[12px] text-ink-500">{when(e.createdAt)}</span>
                      {e.canDelete && (
                        <button type="button" disabled={busy} onClick={() => remove(e)} aria-label={`${e.author.name}님 글 지우기`}
                          className="-my-2 ml-auto min-h-[36px] px-2 text-[12px] font-semibold text-ink-500 underline disabled:opacity-50">지우기</button>
                      )}
                    </div>
                    <p className="mt-0.5 break-words text-[14px] leading-relaxed text-ink-800">{e.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
