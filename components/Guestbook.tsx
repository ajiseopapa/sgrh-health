'use client'

// 정원 방명록 — 동료 정원(피드 › 이름 › 프로필 창)에서 글을 남기고, 내 정원 탭에서 받은 글을 봅니다.
// 읽기·쓰기 모두 본인 확인한 직원만. 고치기는 쓴 사람만(canEdit), 지우기는 쓴 사람·정원 주인(canDelete) — 서버가 판단.
// 내 정원: 마지막으로 본 뒤 온 글에 '새 글' 표시, 열면 본 것으로 저장(정원 탭 점이 꺼짐).
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useMe } from '@/lib/me'
import { useDialog } from '@/lib/dialog'
import { Loading, Notice } from '@/lib/ui'
import { ProfileAvatar } from './Profile'

const BODY_MAX = 100
const SEEN_EVENT = 'guestbook-seen' // app/page.tsx 정원 탭 점

interface Entry {
  id: string; body: string; createdAt: string; editedAt: string | null
  author: { id: string; name: string; emoji: string | null }
  mine: boolean; canEdit: boolean; canDelete: boolean
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

const clean = (v: string) => v.replace(/\s+/g, ' ').trim()

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
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  // 내 정원: 이번에 열기 전 마지막으로 본 시각. 이보다 늦게 온 동료 글이 '새 글'
  const [seenBefore, setSeenBefore] = useState<string | null | undefined>(undefined)

  const load = useCallback(async () => {
    if (!ready) return
    const r = await api<{ ready: boolean; entries: Entry[]; seenAt?: string | null }>(`/api/game/guestbook?id=${ownerId}`)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '방명록을 불러오지 못했어요.' }); setEntries([]); return }
    setNotReady(!r.data.ready)
    setEntries(r.data.entries)
    return r.data
  }, [ownerId, ready])

  useEffect(() => {
    setEntries(null); setMsg(null); setEditing(null)
    load().then((d) => {
      if (!mine || !d || !d.ready) return
      setSeenBefore((cur) => (cur === undefined ? d.seenAt ?? null : cur)) // 처음 연 순간 값만 기억
      api('/api/me/guestbook', { method: 'POST', body: {} }).then(() => window.dispatchEvent(new Event(SEEN_EVENT)))
    })
  }, [load, mine])

  async function write() {
    const text = clean(draft)
    if (!text || busy) return
    setBusy(true); setMsg(null)
    const r = await api('/api/game/guestbook', { method: 'POST', body: { ownerId, body: text } })
    setBusy(false)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '남기지 못했어요.' }); return }
    setDraft('')
    await load()
  }

  async function saveEdit() {
    if (!editing || busy) return
    const text = clean(editing.text)
    if (!text) { setMsg({ tone: 'error', text: '글을 비울 수는 없어요. 지우려면 지우기를 눌러 주세요.' }); return }
    setBusy(true); setMsg(null)
    const r = await api<{ changed: boolean; editedAt?: string }>('/api/game/guestbook', { method: 'PATCH', body: { id: editing.id, body: text } })
    setBusy(false)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '고치지 못했어요.' }); return }
    if (r.data.changed) setEntries((cur) => (cur ?? []).map((x) => (x.id === editing.id ? { ...x, body: text, editedAt: r.data.editedAt ?? new Date().toISOString() } : x)))
    setEditing(null)
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

  const isNew = (e: Entry) => mine && !e.mine && seenBefore !== undefined && (seenBefore === null || e.createdAt > seenBefore)
  const newCount = entries ? entries.filter(isNew).length : 0
  const len = [...draft].length
  const linkBtn = 'min-h-[36px] px-2 text-[12px] font-semibold text-ink-500 underline disabled:opacity-50'
  return (
    <section className="mt-5 w-full border-t border-line pt-4 text-left" aria-labelledby={`guestbook-${ownerId}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`guestbook-${ownerId}`} className="text-[15px] font-bold text-ink-900">
          {mine ? '내 정원 방명록' : '방명록'}
          {newCount > 0 && <span className="ml-2 rounded-full border-2 border-ink-900 bg-brand-300 px-2 py-0.5 text-[12px] font-extrabold">새 글 {newCount}</span>}
        </h3>
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
              {entries.map((e) => {
                const ed = editing?.id === e.id ? editing : null
                return (
                  <li key={e.id} className="flex gap-3">
                    <ProfileAvatar emoji={e.author.emoji} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[14px] font-bold text-ink-900">{e.author.name}</span>
                        <span className="text-[12px] text-ink-500">{when(e.createdAt)}{e.editedAt ? ' · 수정됨' : ''}</span>
                        {isNew(e) && <span className="text-[12px] font-extrabold text-ink-900">● 새 글</span>}
                        {!ed && (e.canEdit || e.canDelete) && (
                          <span className="-my-2 ml-auto flex">
                            {e.canEdit && <button type="button" disabled={busy} onClick={() => { setMsg(null); setEditing({ id: e.id, text: e.body }) }} aria-label="내 글 고치기" className={linkBtn}>수정</button>}
                            {e.canDelete && <button type="button" disabled={busy} onClick={() => remove(e)} aria-label={`${e.author.name}님 글 지우기`} className={linkBtn}>지우기</button>}
                          </span>
                        )}
                      </div>
                      {ed ? (
                        <div className="mt-1.5">
                          <label htmlFor={`guestbook-edit-${e.id}`} className="sr-only">내 글 고치기</label>
                          <input id={`guestbook-edit-${e.id}`} autoFocus value={ed.text} maxLength={BODY_MAX}
                            onChange={(ev) => setEditing({ id: e.id, text: ev.target.value })}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter' && !ev.nativeEvent.isComposing) { ev.preventDefault(); saveEdit() }
                              if (ev.key === 'Escape') { ev.stopPropagation(); setEditing(null) }
                            }}
                            className="input-field w-full" />
                          <div className="mt-2 flex justify-end gap-2">
                            <button type="button" disabled={busy} onClick={() => setEditing(null)} className="btn-secondary w-auto px-4">취소</button>
                            <button type="button" disabled={busy || !ed.text.trim()} onClick={saveEdit} className="btn-primary w-auto px-4">저장</button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-0.5 break-words text-[14px] leading-relaxed text-ink-800">{e.body}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
