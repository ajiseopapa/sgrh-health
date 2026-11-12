'use client'

// 달력에서 고른 날짜의 상세 — 요약(참여 인원·기록 수·총 시간)은 달력 집계값을 그대로 쓰고,
// 직원별 기록은 그 날짜 것만 30건씩 나눠 불러옵니다(기록이 많아도 한 번에 다 받지 않음).
import { Icon } from '@/lib/ui'
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
  headcount,
  rateLabel,
  refreshKey,
  onClose,
}: {
  date: string // 'YYYY-MM-DD'
  summary: DaySummary | undefined
  headcount: number | null
  rateLabel: string
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
    <div className="mt-5 space-y-4 border-t border-ink-900 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-[17px] font-extrabold tracking-[-0.02em] text-ink-900">{title}</p>
        <button
          onClick={onClose}
          aria-label="날짜 상세 닫기"
          className="-mr-2.5 flex h-11 w-11 items-center justify-center rounded-lg text-ink-700 transition active:bg-ink-50"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="num text-[26px] leading-none text-brand-600">{p}<span className="ml-0.5 text-[13px] font-bold text-ink-500">명</span></p>
          <p className="mt-1 text-[12px] text-ink-500">참여</p>
        </div>
        <div>
          <p className="num text-[26px] leading-none text-ink-900">{n}<span className="ml-0.5 text-[13px] font-bold text-ink-500">회</span></p>
          <p className="mt-1 text-[12px] text-ink-500">기록</p>
        </div>
        <div>
          <p className="text-[15px] font-extrabold leading-[26px] tabular-nums text-ink-900">{s > 0 ? formatDuration(s) : '-'}</p>
          <p className="mt-1 text-[12px] text-ink-500">총 운동 시간</p>
        </div>
      </div>

      {/* 참여율 (분모가 없으면 비율 대신 "인원 정보 없음") */}
      <p className="text-[13px] text-ink-600">
        {headcount ? (
          <>
            {rateLabel}{' '}
            <span className="font-semibold text-ink-700">{Math.min(100, Math.round((p / headcount) * 100))}%</span>
            <span className="text-ink-500"> ({p}/{headcount}명)</span>
          </>
        ) : (
          <>참여율: <span className="font-semibold text-ink-600">인원 정보 없음</span></>
        )}
      </p>

      {/* 직원별 기록 */}
      {n === 0 && !loading ? (
        <p className="py-3 text-[14px] text-ink-500">이날은 운동 기록이 없어요.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {groups.map((g) => (
            <li key={g.name + g.color} className="flex gap-3 py-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: g.color }}
              >
                {g.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-ink-900">
                  {g.name}
                  {g.logs.length > 1 && <span className="ml-1 text-[13px] font-normal text-ink-500">{g.logs.length}회</span>}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {g.logs.map((l) => {
                    const sec = secondsOf(l)
                    return (
                      <span key={l.id} className="inline-flex items-center gap-1 text-[13px] text-ink-700">
                        {l.exercise_type?.icon} {l.exercise_type?.name ?? '운동'}
                        <span className="text-ink-500">· {sec ? formatDuration(sec) : '시간 없음'}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {loading && <div className="h-10 animate-pulse rounded-md bg-ink-100" />}
      {error && <p role="alert" className="text-[14px] font-semibold text-red-700">{error}</p>}
      {!loading && rows.length < total && (
        <button onClick={() => fetchPage(rows.length)} className="btn-secondary w-full text-sm">
          기록 더 보기 ({rows.length}/{total})
        </button>
      )}
    </div>
  )
}
