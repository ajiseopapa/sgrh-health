'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, ExerciseLog, ExerciseType, LogReaction, calcPace, formatDuration } from '@/types/database'
import { getEmployeeColor } from '@/lib/colors'
import { Me, getMe, setMe as saveMe } from '@/lib/me'
import CheerBar from './CheerBar'
import MePickerModal from './MePickerModal'

function getPaceMode(name: string): 'min_per_km' | 'min_per_100m' | 'km_per_h' {
  if (/수영/i.test(name)) return 'min_per_100m'
  if (/자전거|사이클/i.test(name)) return 'km_per_h'
  return 'min_per_km'
}

export default function FeedTab() {
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

  // ── 서로 칭찬하기 ──
  const [reactions, setReactions] = useState<LogReaction[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [me, setMeState] = useState<Me | null>(null)
  const [showMePicker, setShowMePicker] = useState(false)
  // 이름을 아직 안 골랐을 때 누른 응원을 기억해뒀다가, 이름을 고르면 바로 반영합니다.
  const [pendingCheer, setPendingCheer] = useState<{ logId: string; emoji: string } | null>(null)

  async function load() {
    setLoading(true)
    const [logRes, typeRes, empRes] = await Promise.all([
      supabase
        .from('exercise_logs')
        .select('*, employee:employees(*), exercise_type:exercise_types(*)')
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('exercise_types').select('*').order('name'),
      supabase.from('employees').select('*').order('name'),
    ])
    const logList = (logRes.data as ExerciseLog[]) ?? []
    setLogs(logList)
    setExerciseTypes(typeRes.data ?? [])
    setEmployees(empRes.data ?? [])

    if (logList.length > 0) {
      const { data } = await supabase
        .from('log_reactions')
        .select('*, employee:employees(*)')
        .in('log_id', logList.map((l) => l.id))
      setReactions((data as LogReaction[]) ?? [])
    } else {
      setReactions([])
    }
    setLoading(false)
  }

  useEffect(() => {
    setMeState(getMe())
    load()
  }, [])

  // 응원 누르기 — 이름을 아직 안 골랐으면 먼저 물어봅니다.
  function handleToggleCheer(logId: string, emoji: string) {
    if (!me) {
      setPendingCheer({ logId, emoji })
      setShowMePicker(true)
      return
    }
    applyCheer(logId, emoji, me)
  }

  async function applyCheer(logId: string, emoji: string, who: Me) {
    setError('')
    const existing = reactions.find(
      (r) => r.log_id === logId && r.employee_id === who.id && r.emoji === emoji
    )

    // 이미 누른 응원이면 취소
    if (existing) {
      setReactions((prev) => prev.filter((r) => r.id !== existing.id))
      const { error } = await supabase.from('log_reactions').delete().eq('id', existing.id)
      if (error) {
        setError('응원 취소에 실패했어요.')
        load()
      }
      return
    }

    // 낙관적 반영 후 저장 (탭 반응이 즉시 보이도록)
    const tempId = `temp-${logId}-${emoji}`
    const temp: LogReaction = {
      id: tempId,
      log_id: logId,
      employee_id: who.id,
      emoji,
      created_at: new Date().toISOString(),
      employee: employees.find((e) => e.id === who.id),
    }
    setReactions((prev) => [...prev, temp])

    const { data, error } = await supabase
      .from('log_reactions')
      .insert({ log_id: logId, employee_id: who.id, emoji })
      .select('*, employee:employees(*)')
      .single()

    if (error) {
      setReactions((prev) => prev.filter((r) => r.id !== tempId))
      setError('응원을 보내지 못했어요. 잠시 후 다시 시도해주세요.')
      return
    }
    setReactions((prev) => prev.map((r) => (r.id === tempId ? (data as LogReaction) : r)))
  }

  function handlePickMe(employee: Employee) {
    const next: Me = { id: employee.id, name: employee.name }
    saveMe(next)
    setMeState(next)
    setShowMePicker(false)
    if (pendingCheer) {
      applyCheer(pendingCheer.logId, pendingCheer.emoji, next)
      setPendingCheer(null)
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

    const { error } = await supabase
      .from('exercise_logs')
      .update({
        exercise_type_id: editTypeId,
        log_date: editDate,
        duration_seconds: totalSeconds,
        duration_minutes: totalSeconds ? Math.round(totalSeconds / 60) : null,
        distance_km: editDistance ? parseFloat(editDistance) : null,
        memo: editMemo || null,
      })
      .eq('id', editingId)

    if (error) {
      setError(`수정에 실패했어요: ${error.message}`)
      return
    }
    setEditingId(null)
    load()
  }

  async function handleDelete(id: string, employeeName?: string) {
    const ok = window.confirm(`${employeeName ?? '이'} 기록을 삭제할까요?`)
    if (!ok) return
    const { error } = await supabase.from('exercise_logs').delete().eq('id', id)
    if (error) {
      setError(`삭제에 실패했어요: ${error.message}`)
      return
    }
    load()
  }

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-ink-100" />

  if (logs.length === 0) {
    return <div className="card text-center text-sm text-ink-400">아직 기록이 없어요.</div>
  }

  const editingType = exerciseTypes.find((t) => t.id === editTypeId)
  const editingIsDistance = editingType?.track_distance ?? false

  return (
    <div className="space-y-2.5">
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}

      {/* 응원할 때 쓰는 내 이름 — 한 번 고르면 이 기기에 기억됩니다 */}
      <div className="flex items-center justify-end gap-1.5 px-1 text-[11px]">
        {me ? (
          <>
            <span className="text-ink-400">
              응원하는 사람: <span className="font-semibold text-ink-600">{me.name}</span>
            </span>
            <button
              onClick={() => setShowMePicker(true)}
              className="rounded-full px-2 py-0.5 font-medium text-brand-600 transition active:bg-brand-50"
            >
              변경
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowMePicker(true)}
            className="rounded-full px-2 py-0.5 font-medium text-brand-600 transition active:bg-brand-50"
          >
            내 이름 정하기
          </button>
        )}
      </div>

      <ul className="space-y-2.5">
        {logs.map((log) => {
          const typeName = log.exercise_type?.name ?? ''
          const paceMode = getPaceMode(typeName)
          // duration_seconds 우선, 없으면 구버전 duration_minutes * 60 폴백
          const durationSec = log.duration_seconds ?? (log.duration_minutes ? log.duration_minutes * 60 : null)
          const pace = (durationSec && log.distance_km)
            ? calcPace(durationSec, log.distance_km, paceMode)
            : ''
          const isEditing = editingId === log.id

          return (
            <li key={log.id} className="card flex gap-3 py-3.5">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: getEmployeeColor(log.employee) }}
              >
                {log.employee?.name?.[0] ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink-800">{log.employee?.name}</span>
                  {!isEditing && <span className="shrink-0 text-xs text-ink-300">{log.log_date}</span>}
                </div>

                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <select
                      value={editTypeId}
                      onChange={(e) => setEditTypeId(e.target.value)}
                      className="input-field py-1.5 text-sm"
                    >
                      {exerciseTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                      ))}
                    </select>

                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="input-field py-1.5 text-sm"
                    />

                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <input type="number" min={0} max={23} value={editH}
                          onChange={(e) => setEditH(e.target.value)} placeholder="0"
                          className="input-field py-1.5 pr-6 text-right text-sm" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">시</span>
                      </div>
                      <div className="relative flex-1">
                        <input type="number" min={0} max={59} value={editM}
                          onChange={(e) => setEditM(e.target.value)} placeholder="0"
                          className="input-field py-1.5 pr-6 text-right text-sm" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">분</span>
                      </div>
                      <div className="relative flex-1">
                        <input type="number" min={0} max={59} value={editS}
                          onChange={(e) => setEditS(e.target.value)} placeholder="0"
                          className="input-field py-1.5 pr-6 text-right text-sm" />
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
                          className="input-field py-1.5 pr-10 text-right text-sm"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">km</span>
                      </div>
                    )}

                    <textarea
                      value={editMemo}
                      onChange={(e) => setEditMemo(e.target.value)}
                      placeholder="메모"
                      rows={2}
                      className="input-field resize-none py-1.5 text-sm"
                    />

                    <div className="flex gap-2">
                      <button onClick={handleUpdate} className="btn-primary flex-1 py-1.5 text-xs">저장</button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary py-1.5 text-xs">취소</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        {log.exercise_type?.icon} {typeName}
                      </span>
                      {durationSec ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-600">
                          ⏱ {formatDuration(durationSec)}
                        </span>
                      ) : null}
                      {log.distance_km ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-600">
                          📍 {Number(log.distance_km).toFixed(2)} km
                        </span>
                      ) : null}
                      {pace ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-600">
                          ⚡ {pace}
                        </span>
                      ) : null}
                    </div>

                    {log.memo && <p className="mt-1.5 text-xs italic text-ink-400">"{log.memo}"</p>}

                    <CheerBar
                      reactions={reactions.filter((r) => r.log_id === log.id)}
                      myId={me?.id}
                      isOwn={me?.id === log.employee_id}
                      onToggle={(emoji) => handleToggleCheer(log.id, emoji)}
                    />

                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => startEdit(log)}
                        className="pill-action bg-brand-50 text-brand-700"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(log.id, log.employee?.name)}
                        className="pill-action bg-red-50 text-red-500"
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {showMePicker && (
        <MePickerModal
          employees={employees}
          current={me}
          onSelect={handlePickMe}
          onClose={() => {
            setShowMePicker(false)
            setPendingCheer(null)
          }}
        />
      )}
    </div>
  )
}
