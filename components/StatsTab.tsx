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
import SectionTitle from './SectionTitle'

const RANK_BADGE_CLASS = ['bg-accent-400 text-white', 'bg-ink-300 text-white', 'bg-ink-300 text-white']
const RANK_BADGE_DEFAULT = 'bg-ink-100 text-ink-500'

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

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-ink-100" />

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
      <div className="card text-center text-sm text-ink-400">
        최근 8주간 운동 기록이 없어요.
        <br />
        홈 탭에서 기록을 남겨보세요!
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <SectionTitle>종목별 운동 횟수</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={typeData}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={{ stroke: '#EAE8E2' }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #EAE8E2', fontSize: 12 }}
              cursor={{ fill: '#EAF6F1' }}
            />
            <Bar dataKey="count" fill="#1F9B7D" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <SectionTitle>최근 8주 추이</SectionTitle>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={weekData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EAE8E2" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#8F8B7D' }} axisLine={{ stroke: '#EAE8E2' }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EAE8E2', fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#0F8268"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#0F8268', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section>
        <SectionTitle>전체 랭킹 (최근 8주)</SectionTitle>
        <ul className="card divide-y divide-ink-100 p-0">
          {employeeRanking.map((e, i) => (
            <li key={e.name} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    RANK_BADGE_CLASS[i] ?? RANK_BADGE_DEFAULT
                  }`}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-ink-800">{e.name}</span>
              </div>
              <span className="text-xs font-medium text-ink-400">{e.count}회</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
