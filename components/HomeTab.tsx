'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, ExerciseType, ExerciseLog } from '@/types/database'
import { getMonthRange, toDateKey } from '@/lib/dateUtils'
import TopRankingBoard from './TopRankingBoard'
import MiniCalendar from './MiniCalendar'
import ExerciseLogForm from './ExerciseLogForm'
import GoalProgress from '@/components/GoalProgress'
import StreakBadge from '@/components/StreakBadge'

interface HomeTabProps {
  isAdmin?: boolean
}

export default function HomeTab({ isAdmin = false }: HomeTabProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([])
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { start, end } = getMonthRange()

    const [empRes, typeRes, logRes] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('exercise_types').select('*').order('name'),
      supabase
        .from('exercise_logs')
        .select('*, employee:employees(*), exercise_type:exercise_types(*)')
        .gte('log_date', toDateKey(start))
        .lte('log_date', toDateKey(end))
        .order('log_date', { ascending: false }),
    ])

    if (empRes.data) setEmployees(empRes.data)
    if (typeRes.data) setExerciseTypes(typeRes.data)
    if (logRes.data) setLogs(logRes.data as ExerciseLog[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // 이번 달 선택된 직원의 운동 횟수
  const thisMonthCount = selectedEmployee
    ? logs.filter((log) => log.employee_id === selectedEmployee.id).length
    : 0

  return (
    <div className="space-y-4">
      <TopRankingBoard logs={logs} loading={loading} />
      <MiniCalendar />

      {/* 직원 선택 시 스트릭 + 목표 표시 */}
      {selectedEmployee && (
        <div className="space-y-1">
          <StreakBadge employeeId={selectedEmployee.id} />
          <GoalProgress
            employeeId={selectedEmployee.id}
            currentCount={thisMonthCount}
            isAdmin={isAdmin}
          />
        </div>
      )}

      <ExerciseLogForm
        employees={employees}
        exerciseTypes={exerciseTypes}
        onSuccess={fetchAll}
        onEmployeeSelect={setSelectedEmployee}
      />
    </div>
  )
}
