'use client'

// 운동 알람 — 정해진 요일·시간에 이 기기로 알림을 받습니다.
// 알림 허용은 '저장' 버튼을 누를 때만 묻습니다.
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useMe } from '@/lib/me'
import { Loading, NeedLogin, Notice } from '@/lib/ui'
import InfoTip from './InfoTip'

type Reminder = { enabled: boolean; time: string; days: number[] }
type Loaded = { ready: boolean; vapidKey?: string; devices?: number; reminder?: Reminder | null }

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // 월요일부터 보여 줌
const HOURS = Array.from({ length: 19 }, (_, i) => i + 5) // 05시 ~ 23시
const MINUTES = [0, 10, 20, 30, 40, 50]
const pad = (n: number) => String(n).padStart(2, '0')

function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}
function isIos() {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
}
function isInstalled() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}
function keyBytes(b64url: string) {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

/** 이 기기를 알림 받을 기기로 등록. 실패하면 사용자에게 보여 줄 문구를 돌려줍니다. */
async function subscribeThisDevice(vapidKey: string): Promise<string | null> {
  if (!pushSupported()) {
    return isIos() ? '아이폰은 홈 화면에 추가한 뒤, 홈 화면의 움트다에서 알람을 켜 주세요.' : '이 브라우저에서는 알림을 받을 수 없어요.'
  }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return '알림이 꺼져 있어요. 휴대폰 설정에서 움트다(또는 브라우저) 알림을 허용해 주세요.'
  try {
    await navigator.serviceWorker.register('/sw.js')
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }))
    const r = await api('/api/me/push', { method: 'POST', body: { endpoint: sub.endpoint } })
    return r.ok ? null : r.message || '이 기기를 등록하지 못했어요.'
  } catch {
    return '이 기기를 알림 받을 기기로 등록하지 못했어요. 잠시 뒤 다시 해 주세요.'
  }
}

export default function ReminderSettings() {
  const { me, requireMe } = useMe()
  const [state, setState] = useState<Loaded | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [hour, setHour] = useState(18)
  const [minute, setMinute] = useState(0)
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!me) { setState(null); return }
    let alive = true
    api<Loaded>('/api/me/reminder').then((r) => {
      if (!alive) return
      const d = r.ok ? r.data : { ready: false }
      setState(d)
      if (d.reminder) {
        setEnabled(d.reminder.enabled)
        setHour(Number(d.reminder.time.slice(0, 2)))
        setMinute(Number(d.reminder.time.slice(3)))
        setDays(d.reminder.days)
      }
    })
    return () => { alive = false }
  }, [me])

  if (!me) return <NeedLogin text="본인 확인을 하면 운동할 시간을 알람으로 받을 수 있어요." onLogin={() => requireMe()} />
  if (!state) return <Loading lines={2} />
  if (!state.ready) return <p className="text-[14px] text-ink-500">운동 알람은 준비 중이에요.</p>

  async function save() {
    setBusy(true); setMsg(null)
    if (enabled) {
      const err = await subscribeThisDevice(state!.vapidKey!)
      if (err) { setBusy(false); setMsg({ tone: 'error', text: err }); return }
      setState((cur) => (cur ? { ...cur, devices: Math.max(cur.devices ?? 0, 1) } : cur)) // 시험 알림 버튼이 바로 보이게
    }
    const r = await api('/api/me/reminder', { method: 'PUT', body: { enabled, time: `${pad(hour)}:${pad(minute)}`, days } })
    setBusy(false)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '저장하지 못했어요.' }); return }
    setMsg({ tone: 'success', text: enabled ? `${days.length === 7 ? '매일' : DAY_ORDER.filter((d) => days.includes(d)).map((d) => DAYS[d]).join('·')} ${pad(hour)}:${pad(minute)}에 알려 드릴게요.` : '알람을 껐어요.' })
  }

  async function test() {
    setBusy(true); setMsg(null)
    const r = await api('/api/me/push', { method: 'POST', body: { test: true } })
    setBusy(false)
    setMsg(r.ok ? { tone: 'info', text: '시험 알림을 보냈어요. 몇 초 안에 도착해요.' } : { tone: 'error', text: r.message || '보내지 못했어요.' })
  }

  const needInstall = isIos() && !isInstalled()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-bold text-ink-900">정해진 시간에 알림 받기</span>
        <button type="button" role="switch" aria-checked={enabled} aria-label="운동 알람 켜기" onClick={() => setEnabled(!enabled)}
          className="flex h-[44px] w-[60px] shrink-0 items-center justify-center">
          <span className={`relative block h-[32px] w-[56px] rounded-full border-2 border-ink-900 transition-colors ${enabled ? 'bg-brand-300' : 'bg-ink-100'}`}>
            <span className={`absolute top-[2px] h-[24px] w-[24px] rounded-full bg-ink-900 motion-safe:transition-[left] ${enabled ? 'left-[26px]' : 'left-[2px]'}`} />
          </span>
        </button>
      </div>

      {enabled && (
        <>
          {needInstall && (
            <Notice tone="info">아이폰은 Safari 공유 버튼 → &lsquo;홈 화면에 추가&rsquo;를 한 뒤, 홈 화면의 움트다에서 알람을 저장해야 알림이 와요.</Notice>
          )}
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-ink-500">시간</p>
            <div className="flex items-center gap-2">
              <select aria-label="시" value={hour} onChange={(e) => setHour(Number(e.target.value))} className="input-field w-auto">
                {HOURS.map((h) => <option key={h} value={h}>{pad(h)}시</option>)}
              </select>
              <select aria-label="분" value={minute} onChange={(e) => setMinute(Number(e.target.value))} className="input-field w-auto">
                {MINUTES.map((m) => <option key={m} value={m}>{pad(m)}분</option>)}
              </select>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-ink-500">요일</p>
            <div className="flex gap-1.5" role="group" aria-label="알람 요일">
              {DAY_ORDER.map((d) => {
                const on = days.includes(d)
                return (
                  <button key={d} type="button" aria-pressed={on}
                    onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                    className={`h-10 flex-1 rounded-lg text-[14px] font-bold transition-colors ${on ? 'bg-brand-300 text-ink-900' : 'bg-ink-50 text-ink-500'}`}>
                    {DAYS[d]}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy} className="btn-primary flex-1">{busy ? '저장 중…' : '알람 저장'}</button>
        {enabled && (state.devices ?? 0) > 0 && (
          <button type="button" onClick={test} disabled={busy} className="btn-secondary">시험 알림</button>
        )}
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {enabled && state.reminder?.enabled && (state.devices ?? 0) === 0 && !msg && (
        <Notice tone="info">알림을 받을 기기가 없어요. 이 기기에서 &lsquo;알람 저장&rsquo;을 한 번 더 눌러 주세요.</Notice>
      )}

      <InfoTip label="알람 안내">
        <ul className="space-y-1">
          <li>알람을 저장한 기기로 알림이 와요. 워치에서 휴대폰 알림을 받도록 해 두었다면 워치에도 떠요.</li>
          <li>알림은 정한 시각부터 몇 분 안에 도착해요.</li>
          <li>아이폰은 홈 화면에 추가한 움트다에서만 알림을 받을 수 있어요. 그 안에서 본인 확인을 다시 해야 할 수 있어요.</li>
        </ul>
      </InfoTip>
    </div>
  )
}
