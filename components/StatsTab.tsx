'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { ExerciseLog, calcPace, isRunningType, getPaceMode } from '@/types/database'
import { getEmployeeColor, TOKENS } from '@/lib/colors'
import { getMonthRange, toDateKey, calcStreak } from '@/lib/dateUtils'
import { Empty, Loading, Progress } from '@/lib/ui'

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
          .select('*, employee:employees(id, name, employee_number, color, created_at), exercise_type:exercise_types(*)')
          .gte('log_date', toDateKey(since)),
        supabase.from('exercise_logs').select('*', { count: 'exact', head: true }),
      ])
      setLogs((logRes.data as ExerciseLog[]) ?? [])
      setAllTimeTotal(countRes.count ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Loading lines={4} />
  if (logs.length === 0) return <Empty title="최근 운동 기록이 없어요." desc="기록 탭에서 첫 운동을 남겨 보세요." />

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
    if (l.exercise_type?.track_distance && isRunningType(l.exercise_type.name) && l.distance_km && l.duration_seconds) {
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
              text: `${typeName} 최고 페이스 신기록! ${calcPace(bestPaceLog.duration_seconds!, bestPaceLog.distance_km!, getPaceMode(typeName))}`,
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
  const weekdayMax = Math.max(...weekdayCount)
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
      <div className="min-w-[130px] rounded-lg border border-ink-200 bg-sheet p-3 text-[13px] shadow-raised">
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

  const H3 = ({ children }: { children: React.ReactNode }) => (
    <h3 className="mb-3 text-[14px] font-bold text-ink-900">{children}</h3>
  )
  const AXIS = { fontSize: 12, fill: '#5E6A64' }

  return (
    <div className="space-y-8">
      {/* 이번 달 팀 기록 */}
      <div>
        <p className="text-[13px] font-semibold text-ink-500">이번 달 팀 전체</p>
        <p className="num mt-1 text-[44px] leading-none text-ink-900">
          {thisCount}<span className="ml-0.5 text-[16px] font-bold tracking-normal text-ink-500">회</span>
        </p>
        <p className="mt-2 text-[14px] text-ink-600">
          {changePct !== null && <>지난달보다 <span className="font-bold text-ink-900">{changePct >= 0 ? `${changePct}% 많아요` : `${Math.abs(changePct)}% 적어요`}</span>. </>}
          {totalDistanceYear > 0 && <>최근 1년 이동 거리 {totalDistanceYear.toFixed(1)}km, 서울–부산({SEOUL_BUSAN_KM}km)의 <span className="font-bold text-ink-900">{busanPct.toFixed(0)}%</span>.</>}
        </p>
      </div>

      {/* 팀 마일스톤 */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <H3>팀 누적 목표</H3>
          <span className="text-[13px] font-bold tabular-nums text-ink-700">{total.toLocaleString()} / {msNext.toLocaleString()}회</span>
        </div>
        <Progress value={total} max={msNext} label="팀 누적 목표 진행" tone="highlight" />
        <p className="mt-2 text-[13px] text-ink-500">다음 목표까지 {msNext - total}회 남았어요.</p>
      </div>

      {/* 이번 달 하이라이트 */}
      {highlights.length > 0 && (
        <div>
          <H3>이번 달 하이라이트</H3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4">
            {highlights.map((h) => (
              <div key={h.label}>
                <dt className="text-[13px] text-ink-500">{h.label}</dt>
                <dd className="mt-0.5 truncate text-[16px] font-bold text-ink-900">{h.name}</dd>
                <dd className="text-[13px] tabular-nums text-ink-600">{h.sub}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* 개인 신기록 */}
      {prs.length > 0 && (
        <div>
          <H3>최근 신기록</H3>
          <ul className="divide-y divide-line border-y border-line">
            {prs.slice(0, 5).map((pr) => (
              <li key={pr.key} className="py-3 text-[14px] text-ink-700">
                <span className="mr-1" aria-hidden="true">{pr.typeIcon}</span>
                <span className="font-bold text-ink-900">{pr.empName}</span>님 {pr.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 요일별 운동 패턴 */}
      <div>
        <H3>요일별 운동 (최근 8주)</H3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weekdayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: '#C9CCC5' }} tickLine={false} />
            <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #C9CCC5', background: '#FCFBF7', fontSize: 13 }} formatter={(v: number) => [`${v}회`, '기록']} cursor={{ fill: '#EEECE5' }} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {weekdayData.map((d, i) => (
                // 최고값과 같은 요일은 모두 강조(동점 포함). 라임은 배경과 명암 차이가 작아 진한 테두리를 둠
                weekdayMax > 0 && d.count === weekdayMax
                  ? <Cell key={d.label} fill={TOKENS.highlight} stroke={TOKENS.ink900} strokeWidth={1.5} />
                  : <Cell key={d.label} fill={TOKENS.ink200} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-[13px] text-ink-600">
          가장 많이 운동한 요일은 <span className="font-bold text-ink-900">{busiestLabel}요일</span>이에요.
        </p>
      </div>

      {/* 종목별 × 사람별 (사람 색은 직원 구분용 데이터 색) */}
      <div>
        <H3>종목별 운동 횟수 (사람별, 최근 8주)</H3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={typeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={AXIS} axisLine={{ stroke: '#C9CCC5' }} tickLine={false} />
            <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip content={(props) => <CustomTooltip {...props as Parameters<typeof CustomTooltip>[0]} />} cursor={{ fill: '#EEECE5' }} />
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
          {employees.map((emp) => (
            <div key={emp.name} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: emp.color }} />
              <span className="text-[13px] text-ink-600">{emp.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 개인 순위 */}
      <div>
        <H3>개인 순위 (최근 8주)</H3>
        <ol className="divide-y divide-line border-y border-line">
          {ranking.map((e, i) => (
            <li key={e.name} className="flex items-center gap-4 py-3">
              <span className={`num w-7 text-[20px] ${i === 0 ? 'text-brand-600' : 'text-ink-400'}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink-900">{e.name}</span>
              {e.streak >= 2 && <span className="text-[13px] text-ink-500">{e.streak}일 연속</span>}
              <span className="num w-14 text-right text-[17px] text-ink-900">{e.count}<span className="ml-0.5 text-[12px] font-bold text-ink-500">회</span></span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
