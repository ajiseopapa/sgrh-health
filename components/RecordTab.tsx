'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, ExerciseLog, calcPace, formatDuration } from '@/types/database'
import { getEmployeeColor } from '@/lib/colors'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

function getPaceMode(name: string): 'min_per_km' | 'min_per_100m' | 'km_per_h' {
  if (/수영/i.test(name)) return 'min_per_100m'
  if (/자전거|사이클/i.test(name)) return 'km_per_h'
  return 'min_per_km'
}

export default function RecordTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Employee | null>(null)
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('employees').select('*').order('name').then(({ data }) => setEmployees(data ?? []))
  }, [])

  useEffect(() => {
    if (!selected) { setLogs([]); return }
    setLoading(true)
    supabase
      .from('exercise_logs')
      .select('*, employee:employees(*), exercise_type:exercise_types(*)')
      .eq('employee_id', selected.id)
      .order('log_date', { ascending: false })
      .then(({ data }) => {
        setLogs((data as ExerciseLog[]) ?? [])
        setLoading(false)
      })
  }, [selected])

  const filtered = useMemo(() => {
    if (!query || selected) return []
    const q = query.toLowerCase()
    return employees.filter(e =>
      e.name.toLowerCase().includes(q) || e.employee_number?.toLowerCase().includes(q)
    ).slice(0, 6)
  }, [query, employees, selected])

  // ── 집계 ──
  const stats = useMemo(() => {
    if (!logs.length) return null

    // 종목별 횟수
    const byType = new Map<string, { icon: string; count: number; totalSec: number; totalKm: number }>()
    let totalSec = 0, totalKm = 0

    for (const l of logs) {
      const name  = l.exercise_type?.name ?? '기타'
      const icon  = l.exercise_type?.icon ?? ''
      const sec   = l.duration_seconds ?? (l.duration_minutes ? l.duration_minutes * 60 : 0)
      const km    = Number(l.distance_km ?? 0)
      const cur   = byType.get(name) ?? { icon, count: 0, totalSec: 0, totalKm: 0 }
      cur.count++; cur.totalSec += sec; cur.totalKm += km
      byType.set(name, cur)
      totalSec += sec; totalKm += km
    }

    const byTypeArr = Array.from(byType.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)

    // 월별 추이
    const byMonth = new Map<string, number>()
    for (const l of logs) {
      const [y, m] = l.log_date.split('-')
      const key = `${y}.${m}`
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
    }
    const monthData = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }))

    return { byTypeArr, monthData, totalCount: logs.length, totalSec, totalKm }
  }, [logs])

  const color = selected ? getEmployeeColor(selected) : '#1F9B7D'

  return (
    <div className="space-y-4">
      {/* 직원 검색 */}
      <div className="relative">
        <input
          value={selected ? selected.name : query}
          onChange={e => { setSelected(null); setQuery(e.target.value) }}
          placeholder="이름 또는 사번으로 검색"
          className="input-field"
        />
        {selected && (
          <button
            onClick={() => { setSelected(null); setQuery('') }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 text-sm"
          >✕</button>
        )}
        {filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-xl bg-white py-1 shadow-raised">
            {filtered.map(e => (
              <li
                key={e.id}
                onClick={() => { setSelected(e); setQuery('') }}
                className="cursor-pointer px-3 py-2.5 text-sm text-ink-800 hover:bg-brand-50 flex items-center gap-2"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: getEmployeeColor(e) }}
                >
                  {e.name[0]}
                </span>
                <span>{e.name}</span>
                <span className="text-xs text-ink-300">#{e.employee_number}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 검색 전 안내 */}
      {!selected && (
        <div className="card flex flex-col items-center gap-2 py-10 text-center">
          <span className="text-3xl">🔍</span>
          <p className="text-sm font-medium text-ink-600">직원을 검색하면</p>
          <p className="text-xs text-ink-400">누적 운동 기록과 통계를 볼 수 있어요</p>
        </div>
      )}

      {selected && loading && <div className="h-40 animate-pulse rounded-2xl bg-ink-100" />}

      {selected && !loading && (
        <>
          {/* 직원 헤더 */}
          <div className="card flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold text-white shrink-0"
              style={{ backgroundColor: color }}
            >
              {selected.name[0]}
            </span>
            <div>
              <p className="font-bold text-ink-900">{selected.name}</p>
              <p className="text-xs text-ink-400">#{selected.employee_number}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold" style={{ color }}>{stats?.totalCount ?? 0}</p>
              <p className="text-xs text-ink-400">총 운동 횟수</p>
            </div>
          </div>

          {!stats || logs.length === 0 ? (
            <div className="card text-center text-sm text-ink-400 py-8">아직 운동 기록이 없어요.</div>
          ) : (
            <>
              {/* 요약 카드 */}
              <div className="grid grid-cols-2 gap-3">
                {stats.totalSec > 0 && (
                  <div className="card text-center py-4">
                    <p className="text-2xl">⏱</p>
                    <p className="mt-1 text-sm font-bold text-ink-800">{formatDuration(stats.totalSec)}</p>
                    <p className="text-xs text-ink-400">총 운동 시간</p>
                  </div>
                )}
                {stats.totalKm > 0 && (
                  <div className="card text-center py-4">
                    <p className="text-2xl">📍</p>
                    <p className="mt-1 text-sm font-bold text-ink-800">{stats.totalKm.toFixed(2)} km</p>
                    <p className="text-xs text-ink-400">총 거리</p>
                  </div>
                )}
              </div>

              {/* 종목별 횟수 바 차트 */}
              <section className="card">
                <p className="section-title">종목별 횟수</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={stats.byTypeArr.map(t => ({ name: `${t.icon} ${t.name}`, count: t.count }))}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={{ stroke: '#EAE8E2' }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #EAE8E2', fontSize: 12 }}
                      cursor={{ fill: '#F6F5F2' }}
                      formatter={(v: number) => [`${v}회`, '횟수']}
                    />
                    <Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>

              {/* 종목별 상세 테이블 */}
              <section>
                <p className="section-title mb-2">종목별 상세</p>
                <ul className="card divide-y divide-ink-100 p-0">
                  {stats.byTypeArr.map(t => {
                    const avgSec = t.totalSec ? Math.round(t.totalSec / t.count) : 0
                    const pace = (t.totalSec && t.totalKm)
                      ? calcPace(t.totalSec, t.totalKm, getPaceMode(t.name))
                      : ''
                    return (
                      <li key={t.name} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-ink-800">
                            {t.icon} {t.name}
                          </span>
                          <span className="text-sm font-bold" style={{ color }}>{t.count}회</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {avgSec > 0 && (
                            <span className="text-xs text-ink-400">
                              평균 {formatDuration(avgSec)}
                            </span>
                          )}
                          {t.totalKm > 0 && (
                            <span className="text-xs text-ink-400">
                              총 {t.totalKm.toFixed(2)} km
                            </span>
                          )}
                          {pace && (
                            <span className="text-xs font-medium text-accent-600">
                              ⚡ 평균 페이스 {pace}
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>

              {/* 월별 추이 */}
              {stats.monthData.length > 1 && (
                <section className="card">
                  <p className="section-title">월별 운동 횟수</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={stats.monthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8F8B7D' }} axisLine={{ stroke: '#EAE8E2' }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #EAE8E2', fontSize: 12 }}
                        cursor={{ fill: '#F6F5F2' }}
                        formatter={(v: number) => [`${v}회`, '횟수']}
                      />
                      <Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </section>
              )}

              {/* 최근 기록 리스트 */}
              <section>
                <p className="section-title mb-2">운동 기록</p>
                <ul className="space-y-2">
                  {logs.map(log => {
                    const sec = log.duration_seconds ?? (log.duration_minutes ? log.duration_minutes * 60 : null)
                    return (
                      <li key={log.id} className="card flex items-start gap-3 py-3">
                        <span className="text-xl shrink-0">{log.exercise_type?.icon ?? '🏃'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-ink-800">{log.exercise_type?.name}</span>
                            <span className="text-xs text-ink-300 shrink-0">{log.log_date}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {sec ? (
                              <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-600">
                                ⏱ {formatDuration(sec)}
                              </span>
                            ) : null}
                            {log.distance_km ? (
                              <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-600">
                                📍 {Number(log.distance_km).toFixed(2)} km
                              </span>
                            ) : null}
                            {(sec && log.distance_km) ? (
                              <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-600">
                                ⚡ {calcPace(sec, log.distance_km, getPaceMode(log.exercise_type?.name ?? ''))}
                              </span>
                            ) : null}
                          </div>
                          {log.memo && <p className="mt-1 text-xs italic text-ink-400">"{log.memo}"</p>}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}
