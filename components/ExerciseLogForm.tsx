'use client'

import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, ExerciseType, calcPace } from '@/types/database'
import { toDateKey } from '@/lib/dateUtils'
import SectionTitle from './SectionTitle'

// 종목 이름 기반 페이스 모드 결정
function getPaceMode(name: string): 'min_per_km' | 'min_per_100m' | 'km_per_h' {
  if (/수영/i.test(name)) return 'min_per_100m'
  if (/자전거|사이클/i.test(name)) return 'km_per_h'
  return 'min_per_km'
}

export default function ExerciseLogForm({
  employees,
  exerciseTypes,
  onSuccess,
  onEmployeeSelect,
}: {
  employees: Employee[]
  exerciseTypes: ExerciseType[]
  onSuccess: () => void
  onEmployeeSelect?: (emp: Employee | null) => void
}) {
  const [query, setQuery] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [exerciseTypeId, setExerciseTypeId] = useState('')
  const [date, setDate] = useState(toDateKey(new Date()))
  const [durationH, setDurationH] = useState('')   // 시간
  const [durationM, setDurationM] = useState('')   // 분
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

  // 선택된 종목
  const selectedType = exerciseTypes.find((t) => t.id === exerciseTypeId)
  const isDistanceType = selectedType?.track_distance ?? false
  const paceMode = selectedType ? getPaceMode(selectedType.name) : 'min_per_km'

  // 총 운동 시간(분) 계산
  const totalMinutes = useMemo(() => {
    const h = parseInt(durationH || '0', 10)
    const m = parseInt(durationM || '0', 10)
    return h * 60 + m || null
  }, [durationH, durationM])

  // 실시간 페이스 계산
  const pace = useMemo(() => {
    if (!totalMinutes || !distanceKm) return ''
    const dist = parseFloat(distanceKm)
    if (!dist) return ''
    return calcPace(totalMinutes, dist, paceMode)
  }, [totalMinutes, distanceKm, paceMode])

  function selectEmployee(emp: Employee) {
    setSelectedEmployee(emp)
    setQuery('')
    onEmployeeSelect?.(emp)
  }

  function clearEmployee() {
    setSelectedEmployee(null)
    onEmployeeSelect?.(null)
  }

  function resetForm() {
    setQuery('')
    setSelectedEmployee(null)
    onEmployeeSelect?.(null)
    setExerciseTypeId('')
    setDate(toDateKey(new Date()))
    setDurationH('')
    setDurationM('')
    setDistanceKm('')
    setMemo('')
  }

  async function handleSubmit() {
    if (!selectedEmployee || !exerciseTypeId) {
      setMessage('이름과 운동 종목을 선택해주세요.')
      return
    }
    setSubmitting(true)
    setMessage('')

    const { error } = await supabase.from('exercise_logs').insert({
      employee_id: selectedEmployee.id,
      exercise_type_id: exerciseTypeId,
      log_date: date,
      duration_minutes: totalMinutes,
      distance_km: distanceKm ? parseFloat(distanceKm) : null,
      memo: memo || null,
    })

    setSubmitting(false)

    if (error) {
      setMessage('기록 저장에 실패했어요. 다시 시도해주세요.')
      return
    }

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
          onChange={(e) => {
            clearEmployee()
            setQuery(e.target.value)
          }}
          placeholder="이름 또는 사번 검색"
          className="input-field"
        />
        {filtered.length > 0 && !selectedEmployee && (
          <ul className="absolute z-10 mt-1 w-full max-h-40 overflow-auto rounded-xl bg-white py-1 shadow-raised">
            {filtered.map((e) => (
              <li
                key={e.id}
                onClick={() => selectEmployee(e)}
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
          <option key={t.id} value={t.id}>
            {t.icon} {t.name}
          </option>
        ))}
      </select>

      {/* 날짜 */}
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="input-field"
      />

      {/* 운동 시간 */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-400">운동 시간</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              min={0}
              max={23}
              value={durationH}
              onChange={(e) => setDurationH(e.target.value)}
              placeholder="0"
              className="input-field pr-8 text-right"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">시간</span>
          </div>
          <div className="relative flex-1">
            <input
              type="number"
              min={0}
              max={59}
              value={durationM}
              onChange={(e) => setDurationM(e.target.value)}
              placeholder="0"
              className="input-field pr-6 text-right"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">분</span>
          </div>
        </div>
      </div>

      {/* 거리 (거리 추적 종목일 때만) */}
      {isDistanceType && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-400">거리</p>
          <div className="relative">
            <input
              type="number"
              min={0}
              step={0.01}
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              placeholder="0.00"
              className="input-field pr-10 text-right"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">km</span>
          </div>

          {/* 실시간 페이스 */}
          {pace && (
            <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-2">
              <span className="text-base">⚡</span>
              <span className="text-sm font-semibold text-brand-700">페이스 {pace}</span>
            </div>
          )}
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
