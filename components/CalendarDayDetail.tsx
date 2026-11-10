'use client'

// 달력에서 고른 날짜의 상세 — 요약(참여 인원·기록 수·총 시간)은 달력 집계값을 그대로 쓰고,
// 직원별 기록은 그 날짜 것만 30건씩 나눠 불러옵니다(기록이 많아도 한 번에 다 받지 않음).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getEmployeeColor } from '@/lib/colors'
import { formatDuration } from '@/types/database'
import type { DaySummary } from './MiniCalendar'

const PAGE = 30
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface Row {
  id: string
  employee_id: string
  duration_seconds: number | null
  duration_minutes: number | null
  distance_km: number | null
  employee: { id: string; name: string; color: string | null } | null
  exercise_type: { name: string; icon: string } | null
}

function secondsOf(r: Row) {
  return r.duration_seconds ?? (r.duration_minutes ? r.duration_minutes * 60 : null)
}

export default function CalendarDayDetail({
  date,
  summary,
  refreshKey,
  onClose,
}: {
  date: string // 'YYYY-MM-DD'
  summary: DaySummary | undefined
  refreshKey: number
  onClose: () => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchPage = useCallback(async (from: number) => {
    setLoading(true)
    setError('')
    const { data, count, error } = await supabase
      .from('exercise_logs')
      .select(
        'id, employee_id, duration_seconds, duration_minutes, distance_km, employee:employees(id, name, color), exercise_type:exercise_types(name, icon)',
        { count: 'exact' }
      )
      .eq('log_date', date)
      // 같은 직원 기록이 페이지를 넘어가도 이어서 묶이도록 직원 순서로 정렬
      .order('employee_id', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      setError('기록을 불러오지 못했어요.')
    } else {
      const page = (data ?? []) as unknown as Row[]
      setRows((prev) => (from === 0 ? page : [...prev, ...page]))
      setTotal(count ?? 0)
    }
    setLoading(false)
  }, [date])

  useEffect(() => { fetchPage(0) }, [fetchPage, refreshKey])

  // 직원별로 묶기
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; color: string; logs: Row[] }>()
    for (const r of rows) {
      const g = map.get(r.employee_id) ?? {
        name: r.employee?.name ?? '알 수 없음',
        color: getEmployeeColor(r.employee),
        logs: [],
      }
      g.logs.push(r)
      map.set(r.employee_id, g)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [rows])

  const d = new Date(`${date}T00:00:00`)
  const title = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
  const p = summary?.p ?? 0
  const n = summary?.n ?? 0
  const s = summary?.s ?? 0

  return (
    <div className="card mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink-900">{title}</p>
        <button
          onClick={onClose}
          aria-label="날짜 상세 닫기"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition active:bg-ink-100"
        >
          ✕
        </button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-brand-50 py-2.5">
          <p className="text-base font-bold text-brand-700 tabular-nums">{p}명</p>
          <p className="text-[10px] text-ink-400">참여</p>
        </div>
        <div className="rounded-xl bg-ink-50 py-2.5">
          <p className="text-base font-bold text-ink-800 tabular-nums">{n}회</p>
          <p className="text-[10px] text-ink-400">기록</p>
        </div>
        <div className="rounded-xl bg-ink-50 py-2.5">
          <p className="text-base font-bold text-ink-800">{s > 0 ? formatDuration(s) : '-'}</p>
          <p className="text-[10px] text-ink-400">총 운동 시간</p>
        </div>
      </div>

      {/* 직원별 기록 */}
      {n === 0 && !loading ? (
        <p className="py-4 text-center text-sm text-ink-400">이날은 운동 기록이 없어요.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {groups.map((g) => (
            <li key={g.name + g.color} className="flex gap-3 py-2.5">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: g.color }}
              >
                {g.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-800">
                  {g.name}
                  {g.logs.length > 1 && <span className="ml-1 text-xs font-normal text-ink-400">{g.logs.length}회</span>}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {g.logs.map((l) => {
                    const sec = secondsOf(l)
                    return (
                      <span key={l.id} className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-600">
                        {l.exercise_type?.icon} {l.exercise_type?.name ?? '운동'}
                        <span className="text-ink-400">· {sec ? formatDuration(sec) : '시간 없음'}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {loading && <div className="h-10 animate-pulse rounded-xl bg-ink-100" />}
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      {!loading && rows.length < total && (
        <button onClick={() => fetchPage(rows.length)} className="btn-secondary w-full text-sm">
          기록 더 보기 ({rows.length}/{total})
        </button>
      )}
    </div>
  )
}
