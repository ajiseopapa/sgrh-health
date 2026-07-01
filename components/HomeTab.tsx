'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, ExerciseType, ExerciseLog } from '@/types/database'
import { getMonthRange, toDateKey } from '@/lib/dateUtils'
import TopRankingBoard from './TopRankingBoard'
import MiniCalendar from './MiniCalendar'
import ExerciseLogForm from './ExerciseLogForm'

export default function HomeTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([])
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="space-y-4">
      <TopRankingBoard logs={logs} loading={loading} />
      <MiniCalendar />
      <ExerciseLogForm employees={employees} exerciseTypes={exerciseTypes} onSuccess={fetchAll} />
    </div>
  )
}
