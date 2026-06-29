'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { ExerciseLog } from '@/types/database'
import { getMonthRange, toDateKey } from '@/lib/dateUtils'

export default function StatsTab() {
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { start } = getMonthRange()
      const eightWeeksAgo = new Date(start)
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

      const { data } = await supabase
        .from('exercise_logs')
        .select('*, employee:employees(*), exercise_type:exercise_types(*)')
        .gte('log_date', toDateKey(eightWeeksAgo))

      setLogs((data as ExerciseLog[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />

  // 종목별 집계
  const byType = new Map<string, number>()
  for (const l of logs) {
    const name = l.exercise_type?.name ?? '기타'
    byType.set(name, (byType.get(name) ?? 0) + 1)
  }
  const typeData = Array.from(byType.entries()).map(([name, count]) => ({ name, count }))

  // 최근 8주 주간 추이
  const byWeek = new Map<string, number>()
  for (const l of logs) {
    const d = new Date(l.log_date)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1)
  }
  const weekData = Array.from(byWeek.entries()).map(([week, count]) => ({ week, count }))

  // 전체 기간 직원 랭킹
  const byEmployee = new Map<string, number>()
  for (const l of logs) {
    const name = l.employee?.name ?? '알 수 없음'
    byEmployee.set(name, (byEmployee.get(name) ?? 0) + 1)
  }
  const employeeRanking = Array.from(byEmployee.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  if (logs.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-10">
        최근 8주간 운동 기록이 없어요. 홈 탭에서 기록을 남겨보세요!
      </p>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">종목별 운동 횟수</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={typeData}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">최근 8주 추이</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={weekData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">전체 랭킹 (최근 8주)</h2>
        <ul className="divide-y border rounded-xl">
          {employeeRanking.map((e, i) => (
            <li key={e.name} className="flex justify-between px-3 py-2 text-sm">
              <span>
                {i + 1}. {e.name}
              </span>
              <span className="text-gray-400">{e.count}회</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
