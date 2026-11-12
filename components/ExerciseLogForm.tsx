'use client'

// 운동 기록 입력 — 종목 한 번, 시간 한 번 누르면 저장할 수 있게(날짜는 기본 오늘)
import { useState, useMemo, useRef } from 'react'
import { ExerciseType, calcPace, getPaceMode } from '@/types/database'
import { api, newRequestId } from '@/lib/api'
import { useMe } from '@/lib/me'
import { Notice } from '@/lib/ui'

function seoulDate(offset = 0) {
  const d = new Date(Date.now() + offset * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d)
}
const PRESETS = [15, 30, 45, 60, 90]

export default function ExerciseLogForm({
  exerciseTypes,
  onSuccess,
}: {
  exerciseTypes: ExerciseType[]
  onSuccess: () => void
}) {
  const { me, mustChangePin, loaded, requireMe, logout } = useMe()
  // 같은 입력을 두 번 보내도 한 번만 저장되도록, 기록 한 건마다 요청 번호를 하나씩 씁니다
  const requestIdRef = useRef<string>(newRequestId())
  const [exerciseTypeId, setExerciseTypeId] = useState('')
  const [date, setDate] = useState(seoulDate())
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [memo, setMemo] = useState('')
  const [showMemo, setShowMemo] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const today = seoulDate()
  const yesterday = seoulDate(-1)
  const selectedType = exerciseTypes.find((t) => t.id === exerciseTypeId)
  const isDistanceType = selectedType?.track_distance ?? false
  const paceMode = selectedType ? getPaceMode(selectedType.name) : 'min_per_km'

  const totalSeconds = useMemo(() => {
    const total = parseInt(minutes || '0', 10) * 60 + parseInt(seconds || '0', 10)
    return total > 0 ? total : null
  }, [minutes, seconds])

  const pace = useMemo(() => {
    if (!totalSeconds || !distanceKm) return ''
    const dist = parseFloat(distanceKm)
    return dist ? calcPace(totalSeconds, dist, paceMode) : ''
  }, [totalSeconds, distanceKm, paceMode])

  function resetForm() {
    setExerciseTypeId('')
    setDate(seoulDate())
    setMinutes(''); setSeconds('')
    setDistanceKm(''); setMemo(''); setShowMemo(false)
  }

  async function handleSubmit() {
    if (!me || mustChangePin) { requireMe(); return }
    if (!exerciseTypeId) { setMessage({ tone: 'error', text: '운동 종목을 골라주세요.' }); return }
    if (!totalSeconds) { setMessage({ tone: 'error', text: '운동 시간을 골라주세요.' }); return }
    setSubmitting(true); setMessage(null)
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
      setMessage({ tone: 'error', text: r.message || '저장하지 못했어요. 다시 시도해주세요.' })
      return
    }
    requestIdRef.current = newRequestId()
    const name = selectedType?.name ?? '운동'
    const min = Math.round(totalSeconds / 60)
    resetForm()
    setMessage({ tone: 'success', text: `${name} ${min}분을 기록했어요.` })
    onSuccess()
  }

  return (
    <div className="space-y-6">
      {/* 누구로 기록하는지 */}
      {!loaded ? (
        <div className="h-6 w-40 animate-pulse rounded bg-ink-100" />
      ) : me ? (
        <p className="flex items-center justify-between text-[14px] text-ink-600">
          <span><span className="font-bold text-ink-900">{me.name}</span>님으로 기록
            {mustChangePin && <span className="ml-1 font-semibold text-red-700">· PIN 변경 필요</span>}
          </span>
          <button type="button" onClick={async () => { await logout(); setMessage(null) }} className="pill-action -mr-2.5 text-ink-700 underline">
            다른 사람
          </button>
        </p>
      ) : (
        <button type="button" onClick={() => requireMe()} className="btn-secondary w-full">본인 확인하고 기록하기</button>
      )}

      {/* 1. 종목 */}
      <fieldset>
        <legend className="mb-2.5 text-[14px] font-bold text-ink-900">종목</legend>
        <div className="flex flex-wrap gap-2">
          {exerciseTypes.map((t) => (
            <button key={t.id} type="button" className="chip" aria-pressed={exerciseTypeId === t.id}
              onClick={() => { setExerciseTypeId(t.id); setDistanceKm('') }}>
              <span aria-hidden="true">{t.icon}</span>{t.name}
            </button>
          ))}
        </div>
      </fieldset>

      {/* 2. 시간 */}
      <fieldset>
        <legend className="mb-2.5 text-[14px] font-bold text-ink-900">운동 시간</legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((m) => (
            <button key={m} type="button" className="chip tabular-nums" aria-pressed={minutes === String(m) && !seconds}
              onClick={() => { setMinutes(String(m)); setSeconds('') }}>
              {m}분
            </button>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[14px] text-ink-600">직접</span>
          <label className="relative w-28">
            <span className="sr-only">운동 시간(분) 직접 입력</span>
            <input type="number" inputMode="numeric" min={0} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)}
              placeholder="0" className="input-field pr-8 text-right tabular-nums" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-ink-500">분</span>
          </label>
          {isDistanceType && (
            <label className="relative w-24">
              <span className="sr-only">초</span>
              <input type="number" inputMode="numeric" min={0} max={59} value={seconds} onChange={(e) => setSeconds(e.target.value)}
                placeholder="0" className="input-field pr-8 text-right tabular-nums" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-ink-500">초</span>
            </label>
          )}
        </div>
      </fieldset>

      {/* 거리 (거리 종목만) */}
      {isDistanceType && (
        <div>
          <p className="mb-2.5 text-[14px] font-bold text-ink-900">거리 <span className="font-normal text-ink-500">(선택)</span></p>
          <div className="flex items-center gap-3">
            <label className="relative w-36">
              <span className="sr-only">거리 km</span>
              <input type="number" inputMode="decimal" min={0} step={0.01} value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="0.00" className="input-field pr-10 text-right tabular-nums" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-ink-500">km</span>
            </label>
            <p className="text-[14px] text-ink-600" aria-live="polite">
              {pace ? <>페이스 <span className="font-extrabold tabular-nums text-ink-900">{pace}</span></> : '시간과 거리를 넣으면 페이스가 나와요'}
            </p>
          </div>
        </div>
      )}

      {/* 3. 날짜 */}
      <fieldset>
        <legend className="mb-2.5 text-[14px] font-bold text-ink-900">날짜</legend>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="chip" aria-pressed={date === today} onClick={() => setDate(today)}>오늘</button>
          <button type="button" className="chip" aria-pressed={date === yesterday} onClick={() => setDate(yesterday)}>어제</button>
          <label className="relative">
            <span className="sr-only">다른 날짜</span>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)}
              className={`input-field w-[150px] py-2 text-[14px] ${date !== today && date !== yesterday ? 'border-ink-900' : ''}`} />
          </label>
        </div>
      </fieldset>

      {/* 메모 (접어 둠) */}
      {showMemo ? (
        <label className="block">
          <span className="mb-2.5 block text-[14px] font-bold text-ink-900">메모</span>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} maxLength={300}
            placeholder="한 줄 남기기" className="input-field resize-none" />
        </label>
      ) : (
        <button type="button" onClick={() => setShowMemo(true)} className="pill-action -ml-2.5 text-ink-700 underline">메모 추가</button>
      )}

      <div className="space-y-3">
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
          {submitting ? '저장하는 중' : '기록 저장'}
        </button>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </div>
  )
}
