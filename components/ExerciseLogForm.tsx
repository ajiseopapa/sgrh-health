'use client'

import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, ExerciseType, calcPace, getPaceMode } from '@/types/database'
import { toDateKey } from '@/lib/dateUtils'
import SectionTitle from './SectionTitle'

export default function ExerciseLogForm({
  employees,
  exerciseTypes,
  onSuccess,
}: {
  employees: Employee[]
  exerciseTypes: ExerciseType[]
  onSuccess: () => void
}) {
  const [query, setQuery] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [exerciseTypeId, setExerciseTypeId] = useState('')
  const [date, setDate] = useState(toDateKey(new Date()))
  const [durationH, setDurationH] = useState('')
  const [durationM, setDurationM] = useState('')
  const [durationS, setDurationS] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const filtered = useMemo(() => {
    if (!query) return []
    const q = query.trim().toLowerCase()
    return employees
      .filter((e) => e.name.toLowerCase().includes(q) || e.employee_number?.toLowerCase().includes(q))
      .slice(0, 5)
  }, [employees, query])

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
    setQuery(''); setSelectedEmployee(null); setExerciseTypeId('')
    setDate(toDateKey(new Date()))
    setDurationH(''); setDurationM(''); setDurationS('')
    setDistanceKm(''); setMemo('')
  }

  async function handleSubmit() {
    if (!selectedEmployee || !exerciseTypeId) {
      setMessage('이름과 운동 종목을 선택해주세요.')
      return
    }
    setSubmitting(true); setMessage('')
    const { error } = await supabase.from('exercise_logs').insert({
      employee_id: selectedEmployee.id,
      exercise_type_id: exerciseTypeId,
      log_date: date,
      duration_seconds: totalSeconds,
      duration_minutes: totalSeconds ? Math.round(totalSeconds / 60) : null,
      distance_km: distanceKm ? parseFloat(distanceKm) : null,
      memo: memo || null,
    })
    setSubmitting(false)
    if (error) { setMessage('기록 저장에 실패했어요. 다시 시도해주세요.'); return }
    const name = selectedEmployee.name
    resetForm()
    setMessage(`${name}님의 운동이 기록되었어요! 💪`)
    onSuccess()
  }

  const isSuccess = message.includes('💪')

  return (
    <section className="card space-y-3">
      <SectionTitle>✍️ 운동 기록하기</SectionTitle>

      {/* 이름/사번 검색 */}
      <div className="relative">
        <input
          value={selectedEmployee ? selectedEmployee.name : query}
          onChange={(e) => { setSelectedEmployee(null); setQuery(e.target.value) }}
          placeholder="이름 또는 사번 검색"
          className="input-field"
        />
        {filtered.length > 0 && !selectedEmployee && (
          <ul className="absolute z-10 mt-1 w-full max-h-40 overflow-auto rounded-xl bg-white py-1 shadow-raised">
            {filtered.map((e) => (
              <li
                key={e.id}
                onClick={() => { setSelectedEmployee(e); setQuery('') }}
                className="cursor-pointer px-3 py-2 text-sm text-ink-800 transition hover:bg-brand-50"
              >
                {e.name}
                <span className="ml-1 text-xs text-ink-300">#{e.employee_number}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

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
        <p className="mb-1.5 text-xs font-medium text-ink-400">운동 시간</p>
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
