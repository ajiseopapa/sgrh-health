'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { ExerciseLog } from '@/types/database'
import { getEmployeeColor } from '@/lib/colors'
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
      const ago = new Date(start)
      ago.setDate(ago.getDate() - 56)
      const { data } = await supabase
        .from('exercise_logs')
        .select('*, employee:employees(*), exercise_type:exercise_types(*)')
        .gte('log_date', toDateKey(ago))
      setLogs((data as ExerciseLog[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-ink-100" />
  if (logs.length === 0) {
    return (
      <div className="card text-center text-sm text-ink-400">
        최근 8주간 운동 기록이 없어요.<br />홈 탭에서 기록을 남겨보세요!
      </div>
    )
  }

  // ── 직원 목록 (이름을 dataKey로 사용 — UUID는 recharts에서 불안정) ──
  const empMap = new Map<string, { name: string; color: string }>()
  for (const l of logs) {
    if (l.employee && !empMap.has(l.employee_id)) {
      empMap.set(l.employee_id, { name: l.employee.name, color: getEmployeeColor(l.employee) })
    }
  }
  const employees = Array.from(empMap.values())

  // ── 종목별 × 직원별 집계 — key = 직원 이름 ──
  const typeMap = new Map<string, Record<string, number>>()
  for (const l of logs) {
    const typeName = l.exercise_type?.name ?? '기타'
    const empName  = l.employee?.name ?? '?'
    if (!typeMap.has(typeName)) typeMap.set(typeName, {})
    const row = typeMap.get(typeName)!
    row[empName] = (row[empName] ?? 0) + 1
  }
  const typeData = Array.from(typeMap.entries())
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => {
      const sum = (o: Record<string, unknown>) =>
        employees.reduce((s, e) => s + ((o[e.name] as number) ?? 0), 0)
      return sum(b) - sum(a)
    })

  // ── 주간 추이 ──
  const byWeek = new Map<string, number>()
  for (const l of logs) {
    const d = new Date(l.log_date)
    const ws = new Date(d); ws.setDate(d.getDate() - d.getDay())
    const key = `${ws.getMonth() + 1}/${ws.getDate()}`
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1)
  }
  const weekData = Array.from(byWeek.entries()).map(([week, count]) => ({ week, count }))

  // ── 직원 랭킹 ──
  const rankMap = new Map<string, { name: string; count: number; color: string }>()
  for (const l of logs) {
    const id = l.employee_id
    const cur = rankMap.get(id) ?? { name: l.employee?.name ?? '?', count: 0, color: getEmployeeColor(l.employee) }
    cur.count++
    rankMap.set(id, cur)
  }
  const ranking = Array.from(rankMap.values()).sort((a, b) => b.count - a.count)

  // ── 커스텀 툴팁 ──
  function CustomTooltip({ active, payload, label }: {
    active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string
  }) {
    if (!active || !payload?.length) return null
    const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
    return (
      <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-raised text-xs min-w-[130px]">
        <p className="mb-1.5 font-bold text-ink-800">{label}</p>
        {payload.filter(p => p.value > 0).map(p => (
          <div key={p.name} className="flex items-center justify-between gap-3 py-0.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
              <span className="text-ink-600">{p.name}</span>
            </div>
            <span className="font-semibold text-ink-800">{p.value}회</span>
          </div>
        ))}
        <div className="mt-1.5 border-t border-ink-100 pt-1.5 flex justify-between">
          <span className="text-ink-400">합계</span>
          <span className="font-bold text-ink-800">{total}회</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 종목별 × 사람별 스택 바 */}
      <section className="card">
        <SectionTitle>종목별 운동 횟수 (사람별)</SectionTitle>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={typeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={{ stroke: '#EAE8E2' }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={false} tickLine={false} />
            <Tooltip content={(props) => <CustomTooltip {...props as Parameters<typeof CustomTooltip>[0]} />} cursor={{ fill: '#F6F5F2' }} />
            {employees.map((emp, i) => (
              <Bar
                key={emp.name}
                dataKey={emp.name}
                name={emp.name}
                stackId="a"
                fill={emp.color}
                radius={i === employees.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        {/* 범례 */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {employees.map(emp => (
            <div key={emp.name} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: emp.color }} />
              <span className="text-xs text-ink-600">{emp.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 주간 추이 */}
      <section className="card">
        <SectionTitle>최근 8주 추이</SectionTitle>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={weekData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EAE8E2" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#8F8B7D' }} axisLine={{ stroke: '#EAE8E2' }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EAE8E2', fontSize: 12 }} />
            <Line type="monotone" dataKey="count" name="횟수" stroke="#0F8268" strokeWidth={2.5} dot={{ r: 3, fill: '#0F8268', strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* 전체 랭킹 */}
      <section>
        <SectionTitle>전체 랭킹 (최근 8주)</SectionTitle>
        <ul className="card divide-y divide-ink-100 p-0">
          {ranking.map((e, i) => (
            <li key={e.name} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${RANK_BADGE_CLASS[i] ?? RANK_BADGE_DEFAULT}`}>
                  {i + 1}
                </span>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                  <span className="text-sm font-medium text-ink-800">{e.name}</span>
                </div>
              </div>
              <span className="text-xs font-medium text-ink-400">{e.count}회</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
