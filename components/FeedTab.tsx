'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ExerciseLog } from '@/types/database'
import { colorForId } from '@/lib/colors'

export default function FeedTab() {
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('exercise_logs')
        .select('*, employee:employees(*), exercise_type:exercise_types(*)')
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)
      setLogs((data as ExerciseLog[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />

  if (logs.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-10">아직 기록이 없어요.</p>
  }

  return (
    <ul className="space-y-3">
      {logs.map((log) => (
        <li key={log.id} className="border rounded-xl p-3 flex gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
            style={{ backgroundColor: colorForId(log.employee_id) }}
          >
            {log.employee?.name?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{log.employee?.name}</span>
              <span className="text-xs text-gray-400 shrink-0">{log.log_date}</span>
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              {log.exercise_type?.icon} {log.exercise_type?.name}
            </p>
            {log.memo && <p className="text-xs text-gray-400 mt-1">“{log.memo}”</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}
