'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ExerciseLog, ExerciseType, calcPace, formatDuration } from '@/types/database'
import { getEmployeeColor, textOnColor } from '@/lib/colors'
import { getDeviceId } from '@/lib/device'
import { api } from '@/lib/api'
import { useMe } from '@/lib/me'
import { useDialog } from '@/lib/dialog'
import CheerBar, { CheerState } from './CheerBar'
import { Empty, Loading, Notice, PageHead } from '@/lib/ui'
import PeerSearch from './PeerSearch'
import { characterOf, SHOW_ITEM_SHOP } from '@/lib/game'
import { PeerSheet, ProfileAvatar } from './Profile'

// 피드에 캐릭터 공개를 켠 직원만 이름 옆에 작은 캐릭터(v2.2). 잔액은 서버가 내보내지 않음
type Look = { stage: number; items: string[]; character: string | null }

function getPaceMode(name: string): 'min_per_km' | 'min_per_100m' | 'km_per_h' {
  if (/수영/i.test(name)) return 'min_per_100m'
  if (/자전거|사이클/i.test(name)) return 'km_per_h'
  return 'min_per_km'
}

export default function FeedTab() {
  const { me, isAdmin, requireMe } = useMe()
  const dialog = useDialog()
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTypeId, setEditTypeId] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editH, setEditH] = useState('')
  const [editM, setEditM] = useState('')
  const [editS, setEditS] = useState('')
  const [editDistance, setEditDistance] = useState('')
  const [editMemo, setEditMemo] = useState('')
  const [error, setError] = useState('')

  // ── 서로 칭찬하기 (익명, 기기 기준) ──
  // 키: `${기록 id}|${이모지}` → 응원 수, 이 기기가 눌렀는지. 다른 기기의 식별값은 받지 않습니다.
  const [cheers, setCheers] = useState<Record<string, CheerState>>({})
  const [looks, setLooks] = useState<Record<string, Look>>({})
  const [emojis, setEmojis] = useState<Record<string, string>>({})
  const [peer, setPeer] = useState<{ id: string; name: string } | null>(null) // 이름을 눌러 연 동료 프로필
  // 버튼별로 "마지막으로 누른 상태"와 "보내는 중"을 기억 → 연타해도 요청이 겹치지 않고 마지막 상태로 끝남
  const wanted = useRef(new Map<string, boolean>())
  const sending = useRef(new Set<string>())
  const cheersRef = useRef(cheers)
  cheersRef.current = cheers

  async function load() {
    setLoading(true)
    const [logRes, typeRes] = await Promise.all([
      supabase
        .from('exercise_logs')
        .select('*, employee:employees(id, name, employee_number, color, created_at), exercise_type:exercise_types(*)')
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('exercise_types').select('*').order('name'),
    ])
    const logList = (logRes.data as ExerciseLog[]) ?? []
    setLogs(logList)
    setExerciseTypes(typeRes.data ?? [])

    await loadCheers(logList.map((l) => l.id))
    setLoading(false)
    const ids = [...new Set(logList.map((l) => l.employee_id))].slice(0, 100)
    if (ids.length) {
      const lr = await api<{ looks: Record<string, Look>; emojis?: Record<string, string> }>(`/api/game/feed?ids=${ids.join(',')}`)
      if (lr.ok) { setLooks(lr.data.looks ?? {}); setEmojis(lr.data.emojis ?? {}) }
    }
  }

  async function loadCheers(logIds: string[]) {
    if (logIds.length === 0) return setCheers({})
    const r = await api<{ cheers: { log_id: string; emoji: string; count: number; mine: boolean }[] }>(
      '/api/reactions/summary',
      { method: 'POST', body: { logIds, deviceId: getDeviceId() } }
    )
    if (!r.ok) return
    const next: Record<string, CheerState> = {}
    for (const c of r.data.cheers) next[`${c.log_id}|${c.emoji}`] = { count: c.count, mine: c.mine }
    // 보내는 중인 버튼은 화면의 상태를 그대로 둠(마지막으로 누른 상태 유지)
    setCheers((prev) => {
      for (const key of wanted.current.keys()) if (prev[key]) next[key] = prev[key]
      return next
    })
  }

  useEffect(() => {
    load()
  }, [])

  // 응원 누르기 — 화면을 먼저 바꾸고, 서버에는 "켜기/끄기"를 상태로 보냅니다.
  // 같은 버튼을 빠르게 여러 번 눌러도 요청은 하나씩만 나가고, 마지막으로 누른 상태로 끝납니다.
  function handleToggleCheer(logId: string, emoji: string) {
    setError('')
    const key = `${logId}|${emoji}`
    // 지금 화면에 보이는 상태의 반대로. (보내는 중이면 마지막으로 누른 상태 기준)
    const shownMine = wanted.current.has(key) ? wanted.current.get(key)! : (cheersRef.current[key]?.mine ?? false)
    const on = !shownMine
    wanted.current.set(key, on)
    setCheers((prev) => {
      const cur = prev[key] ?? { count: 0, mine: false }
      if (cur.mine === on) return prev
      return { ...prev, [key]: { mine: on, count: Math.max(0, cur.count + (on ? 1 : -1)) } }
    })
    void sendCheer(logId, emoji)
  }

  async function sendCheer(logId: string, emoji: string) {
    const key = `${logId}|${emoji}`
    if (sending.current.has(key)) return // 보내는 중이면 끝난 뒤 마지막 상태로 한 번 더 보냄
    sending.current.add(key)
    try {
      for (;;) {
        const on = wanted.current.get(key)
        if (on === undefined) return
        const r = await api<{ on: boolean; count: number }>('/api/reactions', {
          method: 'POST',
          body: { logId, deviceId: getDeviceId(), emoji, on },
        })
        if (!r.ok) {
          wanted.current.delete(key)
          setError(on ? '응원을 보내지 못했어요. 잠시 후 다시 시도해주세요.' : '응원 취소에 실패했어요.')
          await loadCheers(logs.map((l) => l.id))
          return
        }
        const latest = wanted.current.get(key)
        if (latest === r.data.on) {
          // 서버 결과가 마지막으로 누른 상태와 같음 → 서버 숫자로 맞추고 끝
          wanted.current.delete(key)
          setCheers((prev) => ({ ...prev, [key]: { mine: r.data.on, count: r.data.count } }))
          return
        }
        // 보내는 동안 다시 눌림 → 화면은 마지막 상태 그대로 두고, 그 상태로 한 번 더 보냄
      }
    } finally {
      sending.current.delete(key)
    }
  }

  function startEdit(log: ExerciseLog) {
    setEditingId(log.id)
    setEditTypeId(log.exercise_type_id)
    setEditDate(log.log_date)
    const sec = log.duration_seconds ?? (log.duration_minutes ? log.duration_minutes * 60 : 0)
    setEditH(sec >= 3600 ? String(Math.floor(sec / 3600)) : '')
    setEditM(sec >= 60 ? String(Math.floor((sec % 3600) / 60)) : '')
    setEditS(String(sec % 60) === '0' ? '' : String(sec % 60))
    setEditDistance(log.distance_km ? String(log.distance_km) : '')
    setEditMemo(log.memo ?? '')
    setError('')
  }

  async function handleUpdate() {
    if (!editingId) return
    const h = parseInt(editH || '0', 10)
    const m = parseInt(editM || '0', 10)
    const s = parseInt(editS || '0', 10)
    const totalSeconds = h * 3600 + m * 60 + s || null

    if (!totalSeconds) { setError('운동 시간을 입력해주세요.'); return }

    const r = await api(`/api/logs/${editingId}`, {
      method: 'PATCH',
      body: {
        exerciseTypeId: editTypeId,
        logDate: editDate,
        durationSeconds: totalSeconds,
        distanceKm: editDistance ? parseFloat(editDistance) : null,
        memo: editMemo || null,
      },
    })

    if (!r.ok) {
      if (r.data.needLogin || r.data.mustChangePin) { requireMe(); return }
      setError(r.message || '수정에 실패했어요.')
      return
    }
    setEditingId(null)
    load()
  }

  async function handleDelete(id: string, employeeName?: string) {
    const ok = await dialog.confirm({
      title: '이 기록을 삭제할까요?',
      message: `${employeeName ? `${employeeName}님의 ` : ''}운동 기록이 지워지고, 달린 응원도 함께 사라져요.`,
      tone: 'danger',
    })
    if (!ok) return
    const r = await api(`/api/logs/${id}`, { method: 'DELETE' })
    if (!r.ok) {
      if (r.data.needLogin || r.data.mustChangePin) { requireMe(); return }
      setError(r.message || '삭제에 실패했어요.')
      return
    }
    load()
  }

  if (loading && logs.length === 0) return <div><PageHead title="피드" sub="동료들이 남긴 최근 운동이에요." /><Loading lines={4} /></div>

  if (logs.length === 0) {
    return <div><PageHead title="피드" /><Empty title="아직 기록이 없어요." desc="기록 탭에서 첫 운동을 남겨 보세요." /></div>
  }

  const editingType = exerciseTypes.find((t) => t.id === editTypeId)
  const editingIsDistance = editingType?.track_distance ?? false

  return (
    <div>
      <PageHead title="피드" sub="동료들이 남긴 최근 운동이에요." />
      <PeerSheet employeeId={peer?.id ?? null} name={peer?.name ?? ''} onClose={() => setPeer(null)} />
      <PeerSearch />
      {error && <div className="pb-3"><Notice tone="error">{error}</Notice></div>}

      <ul className="divide-y divide-line border-t border-line">
        {logs.map((log) => {
          const typeName = log.exercise_type?.name ?? ''
          const paceMode = getPaceMode(typeName)
          // duration_seconds 우선, 없으면 구버전 duration_minutes * 60 폴백
          const durationSec = log.duration_seconds ?? (log.duration_minutes ? log.duration_minutes * 60 : null)
          const pace = (durationSec && log.distance_km)
            ? calcPace(durationSec, log.distance_km, paceMode)
            : ''
          const isEditing = editingId === log.id
          // 버튼 표시는 편의용이고, 실제 허용 여부는 서버가 다시 확인합니다
          const canManage = isAdmin || (me !== null && me.id === log.employee_id)

          return (
            <li key={log.id} className="flex gap-3 py-5">
              {/* 프로필 이모지를 고른 직원은 홈과 같은 프로필 원형, 아니면 기존 이름 첫 글자 원형 */}
              <button type="button" className="h-10 shrink-0 rounded-full" aria-label={`${log.employee?.name ?? ''} 프로필 보기`}
                onClick={() => setPeer({ id: log.employee_id, name: log.employee?.name ?? '' })}>
              {emojis[log.employee_id] ? (
                <ProfileAvatar emoji={emojis[log.employee_id]} size={40} />
              ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[19px] font-bold leading-none"
                style={{ backgroundColor: getEmployeeColor(log.employee), color: textOnColor(getEmployeeColor(log.employee)) }}
                aria-hidden="true"
              >
                {log.employee?.name?.[0] ?? '?'}
              </div>
              )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <button type="button" className="text-[15px] font-bold text-ink-900" onClick={() => setPeer({ id: log.employee_id, name: log.employee?.name ?? '' })}>
                      {log.employee?.name}
                    </button>
                    {looks[log.employee_id] && (
                      // 캐릭터 공개를 켠 직원만. 개인 나무 표시는 PM 결정으로 제거
                      <span className="flex items-end gap-0.5 self-center" title={`${characterOf(looks[log.employee_id].character).name} 캐릭터`}>
                        <img src={characterOf(looks[log.employee_id].character).src} alt={`${characterOf(looks[log.employee_id].character).name} 캐릭터`}
                          width={16} height={24} style={{ imageRendering: 'pixelated', width: 16, height: 24 }} />
                        {SHOW_ITEM_SHOP && <span className="text-[14px] leading-none" aria-hidden="true">{looks[log.employee_id].items.join('')}</span>}
                      </span>
                    )}
                  </span>
                  {!isEditing && <span className="shrink-0 text-[13px] tabular-nums text-ink-500">{log.log_date.slice(5).replace('-', '.')}</span>}
                </div>

                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <select
                      value={editTypeId}
                      onChange={(e) => setEditTypeId(e.target.value)}
                      className="input-field py-2"
                    >
                      {exerciseTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                      ))}
                    </select>

                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="input-field py-2"
                    />

                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <input type="number" min={0} max={23} value={editH}
                          onChange={(e) => setEditH(e.target.value)} placeholder="0"
                          className="input-field py-2 pr-7 text-right tabular-nums" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">시</span>
                      </div>
                      <div className="relative flex-1">
                        <input type="number" min={0} max={59} value={editM}
                          onChange={(e) => setEditM(e.target.value)} placeholder="0"
                          className="input-field py-2 pr-7 text-right tabular-nums" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">분</span>
                      </div>
                      <div className="relative flex-1">
                        <input type="number" min={0} max={59} value={editS}
                          onChange={(e) => setEditS(e.target.value)} placeholder="0"
                          className="input-field py-2 pr-7 text-right tabular-nums" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">초</span>
                      </div>
                    </div>

                    {editingIsDistance && (
                      <div className="relative">
                        <input
                          type="number" min={0} step={0.01}
                          value={editDistance}
                          onChange={(e) => setEditDistance(e.target.value)}
                          placeholder="0.00"
                          className="input-field py-2 pr-10 text-right tabular-nums"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">km</span>
                      </div>
                    )}

                    <textarea
                      value={editMemo}
                      onChange={(e) => setEditMemo(e.target.value)}
                      placeholder="메모"
                      rows={2}
                      className="input-field resize-none py-2"
                    />

                    <div className="flex gap-2">
                      <button onClick={handleUpdate} className="btn-primary flex-1">저장</button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary">취소</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-[15px] text-ink-800">
                      <span aria-hidden="true" className="mr-1">{log.exercise_type?.icon}</span>
                      <span className="font-semibold">{typeName}</span>
                      {durationSec ? <span className="tabular-nums text-ink-600"> · {formatDuration(durationSec)}</span> : null}
                      {log.distance_km ? <span className="tabular-nums text-ink-600"> · {Number(log.distance_km).toFixed(2)}km</span> : null}
                      {pace ? <span className="tabular-nums text-ink-600"> · {pace}</span> : null}
                    </p>

                    {log.memo && <p className="mt-1.5 text-[14px] leading-relaxed text-ink-600">{log.memo}</p>}

                    <CheerBar
                      cheers={{
                        '👏': cheers[`${log.id}|👏`],
                        '💪': cheers[`${log.id}|💪`],
                        '🔥': cheers[`${log.id}|🔥`],
                      }}
                      onToggle={(emoji) => handleToggleCheer(log.id, emoji)}
                    />

                    {canManage && (
                    <div className="-ml-2.5 mt-1 flex gap-1">
                      <button
                        onClick={() => startEdit(log)}
                        className="pill-action text-ink-700"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(log.id, log.employee?.name)}
                        className="pill-action text-red-700"
                      >
                        삭제
                      </button>
                    </div>
                    )}
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
