'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  employeeId: string
  currentCount: number   // 이번 달 운동 횟수 (HomeTab에서 전달)
  isAdmin: boolean
}

const yearMonth = () => new Date().toISOString().slice(0, 7) // 'YYYY-MM'

export default function GoalProgress({ employeeId, currentCount, isAdmin }: Props) {
  const [goal, setGoal] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('employee_goals')
        .select('goal_count')
        .eq('employee_id', employeeId)
        .eq('year_month', yearMonth())
        .maybeSingle()

      const count = data?.goal_count ?? 12
      setGoal(count)
      setInputVal(String(count))
    }
    load()
  }, [employeeId])

  async function saveGoal() {
    const val = parseInt(inputVal)
    if (isNaN(val) || val < 1 || val > 365) return
    setSaving(true)
    await supabase.from('employee_goals').upsert(
      { employee_id: employeeId, year_month: yearMonth(), goal_count: val },
      { onConflict: 'employee_id,year_month' }
    )
    setGoal(val)
    setEditing(false)
    setSaving(false)
  }

  if (goal === null) return null

  const pct = Math.min((currentCount / goal) * 100, 100)
  const done = currentCount >= goal

  return (
    <div className="bg-white rounded-2xl px-4 py-3.5 shadow-sm mx-3 mb-3">
      {/* 상단 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-gray-800">
          {done ? '🎉 이번 달 목표 달성!' : '🎯 이번 달 목표'}
        </span>
        {isAdmin && !editing && (
          <button
            onClick={() => { setEditing(true); setInputVal(String(goal)) }}
            className="text-[11px] text-teal-500 font-medium"
          >
            목표 수정
          </button>
        )}
      </div>

      {/* 편집 모드 */}
      {editing && isAdmin ? (
        <div className="flex items-center gap-2 mb-2">
          <input
            type="number"
            min={1}
            max={365}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <span className="text-sm text-gray-500">회</span>
          <button
            onClick={saveGoal}
            disabled={saving}
            className="text-xs bg-teal-500 text-white px-3 py-1 rounded-full font-medium disabled:opacity-50"
          >
            {saving ? '…' : '저장'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-gray-400"
          >
            취소
          </button>
        </div>
      ) : (
        <p className="text-[12px] text-gray-500 mb-2">
          <span className="font-bold text-teal-600">{currentCount}회</span>
          {' '}달성 / 목표{' '}
          <span className="font-bold text-gray-700">{goal}회</span>
        </p>
      )}

      {/* 프로그레스 바 */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            done
              ? 'bg-gradient-to-r from-yellow-400 to-orange-400'
              : 'bg-gradient-to-r from-teal-400 to-teal-600'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 달성률 텍스트 */}
      {!done && (
        <p className="text-right text-[10px] text-gray-400 mt-1">
          {Math.round(pct)}% 달성
        </p>
      )}
    </div>
  )
}
