'use client'

import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, ExerciseType } from '@/types/database'
import { toDateKey } from '@/lib/dateUtils'

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
      memo: memo || null,
    })

    setSubmitting(false)

    if (error) {
      setMessage('기록 저장에 실패했어요. 다시 시도해주세요.')
      return
    }

    setMessage(`${selectedEmployee.name}님의 운동이 기록되었어요! 💪`)
    setMemo('')
    onSuccess()
  }

  return (
    <section className="border rounded-xl p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-500">✍️ 운동 기록하기</h2>

      <div className="relative">
        <input
          value={selectedEmployee ? selectedEmployee.name : query}
          onChange={(e) => {
            setSelectedEmployee(null)
            setQuery(e.target.value)
          }}
          placeholder="이름 또는 사번 검색"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        {filtered.length > 0 && !selectedEmployee && (
          <ul className="absolute z-10 w-full bg-white border rounded-lg mt-1 shadow-sm max-h-40 overflow-auto">
            {filtered.map((e) => (
              <li
                key={e.id}
                onClick={() => {
                  setSelectedEmployee(e)
                  setQuery('')
                }}
                className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
              >
                {e.name}
                <span className="text-xs text-gray-400 ml-1">#{e.employee_number}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <select
        value={exerciseTypeId}
        onChange={(e) => setExerciseTypeId(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      >
        <option value="">운동 종목 선택</option>
        {exerciseTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.icon} {t.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />

      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="한 줄 메모 (선택)"
        rows={2}
        className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
      />

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-brand-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
      >
        {submitting ? '저장 중...' : '기록 남기기'}
      </button>

      {message && <p className="text-xs text-gray-500">{message}</p>}
    </section>
  )
}
