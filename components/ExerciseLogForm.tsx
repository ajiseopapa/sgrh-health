'use client'

import { useState, useMemo, useRef } from 'react'
import { Employee, ExerciseType, calcPace, getPaceMode } from '@/types/database'
import { api, newRequestId } from '@/lib/api'
import { useMe } from '@/lib/me'
import { toDateKey } from '@/lib/dateUtils'
import SectionTitle from './SectionTitle'

export default function ExerciseLogForm({
  exerciseTypes,
  onSuccess,
}: {
  employees?: Employee[]
  exerciseTypes: ExerciseType[]
  onSuccess: () => void
}) {
  const { me, mustChangePin, loaded, requireMe, logout } = useMe()
  // 같은 입력을 두 번 보내도 한 번만 저장되도록, 기록 한 건마다 요청 번호를 하나씩 씁니다
  const requestIdRef = useRef<string>(newRequestId())
  const [exerciseTypeId, setExerciseTypeId] = useState('')
  const [date, setDate] = useState(toDateKey(new Date()))
  const [durationH, setDurationH] = useState('')
  const [durationM, setDurationM] = useState('')
  const [durationS, setDurationS] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const selectedType = exerciseTypes.find((t) => t.id === exerciseTypeId)
  const isDistanceType = selectedType?.track_distance ?? false
  const paceMode = selectedType ? getPaceMode(selectedType.name) : 'min_per_km'

  // 총 초 계산
  const totalSeconds = useMemo(() => {
    const h = parseInt(durationH || '0', 10)
    const m = parseInt(durationM || '0', 10)
    const s = parseInt(durationS || '0', 10)
    const total = h * 3600 + m * 60 + s
    return total > 0 ? total : null
  }, [durationH, durationM, durationS])

  // 실시간 페이스 (거리 입력 오른쪽에 표시)
  const pace = useMemo(() => {
    if (!totalSeconds || !distanceKm) return ''
    const dist = parseFloat(distanceKm)
    if (!dist) return ''
    return calcPace(totalSeconds, dist, paceMode)
  }, [totalSeconds, distanceKm, paceMode])

  function resetForm() {
    setExerciseTypeId('')
    setDate(toDateKey(new Date()))
    setDurationH(''); setDurationM(''); setDurationS('')
    setDistanceKm(''); setMemo('')
  }

  async function handleSubmit() {
    if (!me || mustChangePin) {
      requireMe()
      return
    }
    if (!exerciseTypeId) { setMessage('운동 종목을 선택해주세요.'); return }
    if (!totalSeconds) { setMessage('운동 시간을 입력해주세요.'); return }
    setSubmitting(true); setMessage('')
    const r = await api('/api/logs', {
      method: 'POST',
      body: {
        requestId: requestIdRef.current,
        exerciseTypeId,
        logDate: date,
        durationSeconds: totalSeconds,
        distanceKm: distanceKm ? parseFloat(distanceKm) : null,
        memo: memo || null,
      },
    })
    setSubmitting(false)
    if (!r.ok) {
      if (r.data.needLogin || r.data.mustChangePin) { requireMe(); return }
      setMessage(r.message || '기록 저장에 실패했어요. 다시 시도해주세요.')
      return
    }
    requestIdRef.current = newRequestId()
    resetForm()
    setMessage(`${me.name}님의 운동이 기록되었어요! 💪`)
    onSuccess()
  }

  const isSuccess = message.includes('💪')

  return (
    <section className="card space-y-3">
      <SectionTitle>✍️ 운동 기록하기</SectionTitle>

      {/* 누구로 기록하는지 — 본인 확인은 처음 한 번만 */}
      {!loaded ? (
        <div className="h-11 animate-pulse rounded-xl bg-ink-100" />
      ) : me ? (
        <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2.5">
          <span className="text-sm text-ink-800">
            <span className="font-semibold">{me.name}</span>님으로 기록 중
            {mustChangePin && <span className="ml-1 text-xs text-red-500">(PIN 변경 필요)</span>}
          </span>
          <button
            type="button"
            onClick={async () => { await logout(); setMessage('') }}
            className="text-xs font-medium text-brand-700"
          >
            바꾸기
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => requireMe()} className="btn-secondary w-full">
          🙋 본인 확인하고 기록하기
        </button>
      )}

      {/* 종목 선택 */}
      <select
        value={exerciseTypeId}
        onChange={(e) => { setExerciseTypeId(e.target.value); setDistanceKm('') }}
        className="input-field"
      >
        <option value="">운동 종목 선택</option>
        {exerciseTypes.map((t) => (
          <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
        ))}
      </select>

      {/* 날짜 */}
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />

      {/* 운동 시간 — 시/분/초 */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-400">운동 시간 <span className="text-red-400">*</span></p>
        <div className="flex gap-1.5">
          {/* 시간 */}
          <div className="relative flex-1">
            <input
              type="number" min={0} max={23}
              value={durationH}
              onChange={(e) => setDurationH(e.target.value)}
              placeholder="0"
              className="input-field py-2.5 pr-7 text-right text-sm"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">시</span>
          </div>
          {/* 분 */}
          <div className="relative flex-1">
            <input
              type="number" min={0} max={59}
              value={durationM}
              onChange={(e) => setDurationM(e.target.value)}
              placeholder="0"
              className="input-field py-2.5 pr-7 text-right text-sm"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">분</span>
          </div>
          {/* 초 */}
          <div className="relative flex-1">
            <input
              type="number" min={0} max={59}
              value={durationS}
              onChange={(e) => setDurationS(e.target.value)}
              placeholder="0"
              className="input-field py-2.5 pr-7 text-right text-sm"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">초</span>
          </div>
        </div>
      </div>

      {/* 거리 + 페이스 인라인 (거리 추적 종목일 때만) */}
      {isDistanceType && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-400">거리</p>
          <div className="flex items-center gap-2">
            {/* 거리 입력 */}
            <div className="relative w-36 shrink-0">
              <input
                type="number" min={0} step={0.01}
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="0.00"
                className="input-field pr-10 text-right text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">km</span>
            </div>

            {/* 페이스 — 입력하는 즉시 오른쪽에 나타남 */}
            <div className={`flex min-h-[42px] flex-1 items-center justify-center rounded-xl px-3 transition-all ${
              pace ? 'bg-brand-50' : 'bg-ink-50'
            }`}>
              {pace ? (
                <div className="text-center">
                  <p className="text-[10px] font-medium text-brand-500">⚡ PACE</p>
                  <p className="text-sm font-bold text-brand-700 leading-tight">{pace}</p>
                </div>
              ) : (
                <p className="text-xs text-ink-300">시간+거리 입력 시 자동 계산</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 메모 */}
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="한 줄 메모 (선택)"
        rows={2}
        className="input-field resize-none"
      />

      <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
        {submitting ? '저장 중...' : '기록 남기기'}
      </button>

      {message && (
        <p className={`text-xs font-medium ${isSuccess ? 'text-brand-600' : 'text-red-500'}`}>
          {message}
        </p>
      )}
    </section>
  )
}
