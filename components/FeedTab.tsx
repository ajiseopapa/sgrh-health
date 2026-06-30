'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ExerciseLog, calcPace } from '@/types/database'
import { colorForId } from '@/lib/colors'

function getPaceMode(name: string): 'min_per_km' | 'min_per_100m' | 'km_per_h' {
  if (/수영/i.test(name)) return 'min_per_100m'
  if (/자전거|사이클/i.test(name)) return 'km_per_h'
  return 'min_per_km'
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return `${h}시간 ${m > 0 ? `${m}분` : ''}`
  return `${m}분`
}

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

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-ink-100" />

  if (logs.length === 0) {
    return <div className="card text-center text-sm text-ink-400">아직 기록이 없어요.</div>
  }

  return (
    <ul className="space-y-2.5">
      {logs.map((log) => {
        const typeName = log.exercise_type?.name ?? ''
        const paceMode = getPaceMode(typeName)
        const pace = (log.duration_minutes && log.distance_km)
          ? calcPace(log.duration_minutes, log.distance_km, paceMode)
          : ''

        return (
          <li key={log.id} className="card flex gap-3 py-3.5">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: colorForId(log.employee_id) }}
            >
              {log.employee?.name?.[0] ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-800">{log.employee?.name}</span>
                <span className="shrink-0 text-xs text-ink-300">{log.log_date}</span>
              </div>

              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {log.exercise_type?.icon} {typeName}
                </span>
                {log.duration_minutes ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-600">
                    ⏱ {formatDuration(log.duration_minutes)}
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
            </div>
          </li>
        )
      })}
    </ul>
  )
}
