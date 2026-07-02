'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { ExerciseLog, calcPace } from '@/types/database'
import { getEmployeeColor } from '@/lib/colors'
import { getMonthRange, toDateKey, calcStreak } from '@/lib/dateUtils'
import SectionTitle from './SectionTitle'

const RANK_BADGE_CLASS = ['bg-accent-400 text-white', 'bg-ink-300 text-white', 'bg-ink-300 text-white']
const RANK_BADGE_DEFAULT = 'bg-ink-100 text-ink-500'
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// 스택 바 차트에서 "맨 위 세그먼트"에만 둥근 상단을 그려주는 커스텀 shape.
// recharts의 Bar radius prop은 세그먼트별로 다르게 줄 수 없어서 직접 그림.
function StackedBarShape(props: {
  x?: number; y?: number; width?: number; height?: number; fill?: string; isTop?: boolean
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill, isTop } = props
  if (height <= 0 || width <= 0) return null
  if (!isTop) {
    return <rect x={x} y={y} width={width} height={height} fill={fill} />
  }
  const r = Math.min(6, width / 2, height)
  const d = `
    M${x},${y + height}
    L${x},${y + r}
    Q${x},${y} ${x + r},${y}
    L${x + width - r},${y}
    Q${x + width},${y} ${x + width},${y + r}
    L${x + width},${y + height}
    Z
  `
  return <path d={d} fill={fill} />
}
const STATS_LOOKBACK_DAYS = 371 // 개인 신기록/마일스톤 계산을 위한 조회 범위 (53주)
const SEOUL_BUSAN_KM = 325
const MILESTONES = [50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000]

type EmpInfo = { id: string; name: string; color: string }

function nextMilestone(total: number): { prev: number; next: number } {
  for (const m of MILESTONES) {
    if (total < m) {
      const idx = MILESTONES.indexOf(m)
      return { prev: idx === 0 ? 0 : MILESTONES[idx - 1], next: m }
    }
  }
  // 최대치를 넘으면 5000 단위로 계속 증가
  const last = MILESTONES[MILESTONES.length - 1]
  const over = Math.floor((total - last) / 5000)
  return { prev: last + over * 5000, next: last + (over + 1) * 5000 }
}

export default function StatsTab() {
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [allTimeTotal, setAllTimeTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const since = new Date()
      since.setDate(since.getDate() - STATS_LOOKBACK_DAYS)

      const [logRes, countRes] = await Promise.all([
        supabase
          .from('exercise_logs')
          .select('*, employee:employees(*), exercise_type:exercise_types(*)')
          .gte('log_date', toDateKey(since)),
        supabase.from('exercise_logs').select('*', { count: 'exact', head: true }),
      ])
      setLogs((logRes.data as ExerciseLog[]) ?? [])
      setAllTimeTotal(countRes.count ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-ink-100" />
  if (logs.length === 0) {
    return (
      <div className="card text-center text-sm text-ink-400">
        최근 운동 기록이 없어요.<br />홈 탭에서 기록을 남겨보세요!
      </div>
    )
  }

  const now = new Date()
  const { start: thisMonthStart } = getMonthRange(now)
  const lastMonthBase = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const { start: lastMonthStart } = getMonthRange(lastMonthBase)
  const thisMonthKey = toDateKey(thisMonthStart).slice(0, 7)
  const lastMonthKey = toDateKey(lastMonthStart).slice(0, 7)

  const thisMonthLogs = logs.filter(l => l.log_date.slice(0, 7) === thisMonthKey)
  const lastMonthLogs = logs.filter(l => l.log_date.slice(0, 7) === lastMonthKey)
  const last8wLogs = logs.filter(l => {
    const d = new Date(l.log_date)
    const diffDays = (now.getTime() - d.getTime()) / 86_400_000
    return diffDays <= 56
  })

  // ── 직원별 로그 그룹 (스트릭·PR은 전체 기간 기준) ──
  const empMap = new Map<string, EmpInfo>()
  const empLogs = new Map<string, ExerciseLog[]>()
  for (const l of logs) {
    if (!l.employee) continue
    if (!empMap.has(l.employee_id)) {
      empMap.set(l.employee_id, { id: l.employee_id, name: l.employee.name, color: getEmployeeColor(l.employee) })
    }
    const arr = empLogs.get(l.employee_id) ?? []
    arr.push(l)
    empLogs.set(l.employee_id, arr)
  }
  const employees = Array.from(empMap.values())

  // ══════════════════════════════════════════
  // 1. 이번 달 vs 지난달 요약
  // ══════════════════════════════════════════
  const thisCount = thisMonthLogs.length
  const lastCount = lastMonthLogs.length
  const changePct = lastCount === 0 ? null : Math.round(((thisCount - lastCount) / lastCount) * 100)
  const totalDistanceYear = logs.reduce((s, l) => s + (l.distance_km ?? 0), 0)
  const busanPct = totalDistanceYear > 0 ? (totalDistanceYear / SEOUL_BUSAN_KM) * 100 : 0

  // ══════════════════════════════════════════
  // 2. 팀 마일스톤 게이지
  // ══════════════════════════════════════════
  const total = allTimeTotal ?? logs.length
  const { prev: msPrev, next: msNext } = nextMilestone(total)
  const msPct = Math.min(((total - msPrev) / (msNext - msPrev)) * 100, 100)

  // ══════════════════════════════════════════
  // 3. 이번 달 하이라이트: MVP / 스트릭왕 / 거리왕 / 페이스왕
  // ══════════════════════════════════════════
  const mvpRank = new Map<string, number>()
  for (const l of thisMonthLogs) mvpRank.set(l.employee_id, (mvpRank.get(l.employee_id) ?? 0) + 1)
  const mvpId = [...mvpRank.entries()].sort((a, b) => b[1] - a[1])[0]

  let streakKingId: string | null = null
  let streakKingVal = 0
  for (const emp of employees) {
    const dates = (empLogs.get(emp.id) ?? []).map(l => l.log_date)
    const s = calcStreak(dates)
    if (s > streakKingVal) { streakKingVal = s; streakKingId = emp.id }
  }

  const distanceRank = new Map<string, number>()
  for (const l of thisMonthLogs) {
    if (l.distance_km) distanceRank.set(l.employee_id, (distanceRank.get(l.employee_id) ?? 0) + l.distance_km)
  }
  const distanceKingId = [...distanceRank.entries()].sort((a, b) => b[1] - a[1])[0]

  let paceKingId: string | null = null
  let paceKingVal = Infinity
  let paceKingLabel = ''
  for (const l of thisMonthLogs) {
    if (l.exercise_type?.track_distance && l.distance_km && l.duration_seconds) {
      const secPerKm = l.duration_seconds / l.distance_km
      if (secPerKm < paceKingVal) {
        paceKingVal = secPerKm
        paceKingId = l.employee_id
        paceKingLabel = calcPace(l.duration_seconds, l.distance_km, 'min_per_km')
      }
    }
  }

  const highlights = [
    mvpId && { icon: '🏆', label: 'MVP', name: empMap.get(mvpId[0])?.name, sub: `${mvpId[1]}회 기록`, color: empMap.get(mvpId[0])?.color },
    streakKingId && streakKingVal >= 2 && { icon: '🔥', label: '스트릭왕', name: empMap.get(streakKingId)?.name, sub: `${streakKingVal}일 연속`, color: empMap.get(streakKingId)?.color },
    distanceKingId && { icon: '📍', label: '거리왕', name: empMap.get(distanceKingId[0])?.name, sub: `${distanceKingId[1].toFixed(1)}km`, color: empMap.get(distanceKingId[0])?.color },
    paceKingId && { icon: '⚡', label: '페이스왕', name: empMap.get(paceKingId)?.name, sub: paceKingLabel, color: empMap.get(paceKingId)?.color },
  ].filter(Boolean) as { icon: string; label: string; name?: string; sub: string; color?: string }[]

  // ══════════════════════════════════════════
  // 4. 개인 신기록(PR) 알림 — 최근 7일 내 기록이 해당 종목 역대 최고치인 경우
  // ══════════════════════════════════════════
  type PR = { key: string; empName: string; empColor: string; typeName: string; typeIcon: string; text: string; date: string }
  const prs: PR[] = []
  const recentCutoff = new Date(now)
  recentCutoff.setDate(recentCutoff.getDate() - 7)

  for (const emp of employees) {
    const all = empLogs.get(emp.id) ?? []
    const byType = new Map<string, ExerciseLog[]>()
    for (const l of all) {
      const key = l.exercise_type_id
      const arr = byType.get(key) ?? []
      arr.push(l)
      byType.set(key, arr)
    }
    for (const [, typeLogs] of byType) {
      if (typeLogs.length < 2) continue // 기록이 1개뿐이면 "갱신"이 아님
      const typeName = typeLogs[0].exercise_type?.name ?? '운동'
      const typeIcon = typeLogs[0].exercise_type?.icon ?? '💪'
      const trackDistance = typeLogs[0].exercise_type?.track_distance

      if (trackDistance) {
        const best = typeLogs.reduce((m, l) => Math.max(m, l.distance_km ?? 0), 0)
        const bestLog = typeLogs.find(l => (l.distance_km ?? 0) === best && new Date(l.log_date) >= recentCutoff)
        if (bestLog && best > 0) {
          prs.push({
            key: `${emp.id}-${bestLog.exercise_type_id}-dist`,
            empName: emp.name, empColor: emp.color, typeName, typeIcon,
            text: `${typeName} 최장 거리 신기록! ${best.toFixed(1)}km`,
            date: bestLog.log_date,
          })
        }
        const paced = typeLogs.filter(l => l.distance_km && l.duration_seconds)
        if (paced.length >= 2) {
          const bestPace = Math.min(...paced.map(l => l.duration_seconds! / l.distance_km!))
          const bestPaceLog = paced.find(
            l => l.duration_seconds! / l.distance_km! === bestPace && new Date(l.log_date) >= recentCutoff
          )
          if (bestPaceLog) {
            prs.push({
              key: `${emp.id}-${bestPaceLog.exercise_type_id}-pace`,
              empName: emp.name, empColor: emp.color, typeName, typeIcon,
              text: `${typeName} 최고 페이스 신기록! ${calcPace(bestPaceLog.duration_seconds!, bestPaceLog.distance_km!, 'min_per_km')}`,
              date: bestPaceLog.log_date,
            })
          }
        }
      } else {
        const durLogs = typeLogs.filter(l => l.duration_seconds)
        if (durLogs.length >= 2) {
          const best = Math.max(...durLogs.map(l => l.duration_seconds!))
          const bestLog = durLogs.find(l => l.duration_seconds === best && new Date(l.log_date) >= recentCutoff)
          if (bestLog) {
            const m = Math.floor(best / 60)
            prs.push({
              key: `${emp.id}-${bestLog.exercise_type_id}-dur`,
              empName: emp.name, empColor: emp.color, typeName, typeIcon,
              text: `${typeName} 최장 시간 신기록! ${m}분`,
              date: bestLog.log_date,
            })
          }
        }
      }
    }
  }
  prs.sort((a, b) => (a.date < b.date ? 1 : -1))

  // ══════════════════════════════════════════
  // 5. 요일별 운동 패턴 (최근 8주)
  // ══════════════════════════════════════════
  const weekdayCount = Array(7).fill(0)
  for (const l of last8wLogs) weekdayCount[new Date(l.log_date).getDay()]++
  const weekdayData = WEEKDAY_LABELS.map((label, i) => ({ label, count: weekdayCount[i] }))
  const busiestIdx = weekdayCount.indexOf(Math.max(...weekdayCount))
  const busiestLabel = WEEKDAY_LABELS[busiestIdx]

  // ══════════════════════════════════════════
  // 기존: 종목별 × 사람별 스택 바 (최근 8주)
  // ══════════════════════════════════════════
  const typeMap = new Map<string, Record<string, number>>()
  for (const l of last8wLogs) {
    const typeName = l.exercise_type?.name ?? '기타'
    const empName = l.employee?.name ?? '?'
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

  // 스택 바에서 종목(행)마다 실제로 값이 있는 "맨 위" 직원을 찾는다.
  // employees 배열 순서 = 스택 쌓이는 순서(마지막이 맨 위)이므로 뒤에서부터 탐색.
  function topEmployeeOf(row: Record<string, unknown>): string | null {
    for (let i = employees.length - 1; i >= 0; i--) {
      const name = employees[i].name
      if (((row[name] as number) ?? 0) > 0) return name
    }
    return null
  }

  // ── 직원 랭킹 (스트릭 뱃지 포함) ──
  const rankMap = new Map<string, { name: string; count: number; color: string; streak: number }>()
  for (const l of last8wLogs) {
    const id = l.employee_id
    const cur = rankMap.get(id) ?? {
      name: l.employee?.name ?? '?', count: 0, color: getEmployeeColor(l.employee),
      streak: calcStreak((empLogs.get(id) ?? []).map(x => x.log_date)),
    }
    cur.count++
    rankMap.set(id, cur)
  }
  // 횟수가 같으면 연속 일수(스트릭)가 높은 사람을 우선 순위로
  const ranking = Array.from(rankMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.streak - a.streak
  })

  // ── 커스텀 툴팁 ──
  function CustomTooltip({ active, payload, label }: {
    active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string
  }) {
    if (!active || !payload?.length) return null
    const totalV = payload.reduce((s, p) => s + (p.value ?? 0), 0)
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
          <span className="font-bold text-ink-800">{totalV}회</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 이번 달 요약 */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-card">
        <p className="text-xs font-medium text-brand-100">이번 달 팀 기록</p>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-3xl font-bold">{thisCount}회</span>
          {changePct !== null && (
            <span className={`mb-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              changePct >= 0 ? 'bg-white/20' : 'bg-black/15'
            }`}>
              {changePct >= 0 ? '▲' : '▼'} 지난달 대비 {Math.abs(changePct)}%
            </span>
          )}
        </div>
        {totalDistanceYear > 0 && (
          <p className="mt-2 text-[12px] text-brand-100">
            최근 1년간 총 {totalDistanceYear.toFixed(1)}km 이동 — 서울↔부산(약 {SEOUL_BUSAN_KM}km)의{' '}
            <span className="font-bold text-white">{busanPct.toFixed(0)}%</span>
            {busanPct >= 100 && ' 🎉'}
          </p>
        )}
      </section>

      {/* 팀 마일스톤 게이지 */}
      <section className="card">
        <div className="flex items-center justify-between">
          <SectionTitle>🚩 팀 마일스톤</SectionTitle>
          <span className="text-xs font-semibold text-ink-400">{total}회 / {msNext}회</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-700"
            style={{ width: `${msPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-ink-400">
          다음 마일스톤까지 <span className="font-bold text-brand-600">{msNext - total}회</span> 남았어요!
        </p>
      </section>

      {/* 이번 달 하이라이트 */}
      {highlights.length > 0 && (
        <section>
          <SectionTitle>이번 달 하이라이트</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {highlights.map((h) => (
              <div key={h.label} className="card flex items-center gap-3 p-3.5">
                <span className="text-2xl">{h.icon}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-ink-400">{h.label}</p>
                  <p className="truncate text-sm font-bold text-ink-800">{h.name}</p>
                  <p className="text-[11px] text-ink-400">{h.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 개인 신기록 알림 */}
      {prs.length > 0 && (
        <section>
          <SectionTitle>🎉 최근 신기록</SectionTitle>
          <div className="space-y-2">
            {prs.slice(0, 5).map(pr => (
              <div key={pr.key} className="card flex items-center gap-3 p-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                  style={{ backgroundColor: `${pr.empColor}22` }}
                >
                  {pr.typeIcon}
                </span>
                <p className="text-sm text-ink-700">
                  <span className="font-bold" style={{ color: pr.empColor }}>{pr.empName}</span>
                  {'님 '}{pr.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 요일별 운동 패턴 */}
      <section className="card">
        <SectionTitle>요일별 운동 패턴 (최근 8주)</SectionTitle>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weekdayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={{ stroke: '#EAE8E2' }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EAE8E2', fontSize: 12 }} formatter={(v: number) => [`${v}회`, '기록']} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {weekdayData.map((d, i) => (
                <Cell key={d.label} fill={i === busiestIdx ? '#0F8268' : '#CFEBE0'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-ink-400">
          우리 팀은 <span className="font-bold text-brand-600">{busiestLabel}요일</span>에 가장 활발하게 움직여요 💪
        </p>
      </section>

      {/* 종목별 × 사람별 스택 바 */}
      <section className="card">
        <SectionTitle>종목별 운동 횟수 (사람별, 최근 8주)</SectionTitle>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={typeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={{ stroke: '#EAE8E2' }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8F8B7D' }} axisLine={false} tickLine={false} />
            <Tooltip content={(props) => <CustomTooltip {...props as Parameters<typeof CustomTooltip>[0]} />} cursor={{ fill: '#F6F5F2' }} />
            {employees.map((emp) => (
              <Bar
                key={emp.name}
                dataKey={emp.name}
                name={emp.name}
                stackId="a"
                fill={emp.color}
                shape={(shapeProps: unknown) => {
                  const p = shapeProps as { x: number; y: number; width: number; height: number; payload: Record<string, unknown> }
                  const isTop = topEmployeeOf(p.payload) === emp.name
                  return <StackedBarShape {...p} fill={emp.color} isTop={isTop} />
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {employees.map(emp => (
            <div key={emp.name} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: emp.color }} />
              <span className="text-xs text-ink-600">{emp.name}</span>
            </div>
          ))}
        </div>
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
                  {e.streak >= 2 && (
                    <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-500">
                      🔥{e.streak}
                    </span>
                  )}
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
