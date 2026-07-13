'use client'

import { useMemo, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ExerciseLog } from '@/types/database'
import { getEmployeeColor } from '@/lib/colors'
import { getCalendarCells, toDateKey } from '@/lib/dateUtils'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 'YYYY-MM-DD' (Asia/Seoul 기준). toLocaleString → new Date() 왕복 파싱은 브라우저/웹뷰마다
// 결과가 달라질 수 있어(특히 카카오톡 인앱 브라우저 등), Intl.DateTimeFormat으로 직접 파츠를 뽑는다.
function getSeoulYMD() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value) // 1-indexed
  const d = Number(parts.find((p) => p.type === 'day')?.value)
  return { year: y, month: m - 1, day: d } // month는 컴포넌트 내부 규칙(0-indexed)에 맞춤
}

type SeoulYMD = ReturnType<typeof getSeoulYMD>

export default function MiniCalendar() {
  // 오늘 날짜는 반드시 "사용자 기기에서, 마운트된 뒤에" 계산한다.
  // 렌더 중에 초기값으로 계산하면 빌드(프리렌더) 시점의 날짜가 HTML에 박혀서,
  // 배포 후 며칠 지난 뒤 앱을 열면 시작할 때 네모가 빌드한 날짜에 표시될 수 있다.
  // 오늘이 계산되기 전에는 달력을 그리지 않으므로 항상 실제 오늘이 기준이 된다.
  const [today, setToday] = useState<SeoulYMD | null>(null)

  useEffect(() => {
    function refreshToday() {
      setToday(getSeoulYMD())
    }
    refreshToday()
    // 탭이 다시 보이거나(백그라운드 복귀) 창이 포커스를 받을 때 즉시 재계산
    document.addEventListener('visibilitychange', refreshToday)
    window.addEventListener('focus', refreshToday)
    // 오래 켜둔 경우를 대비해 1분마다도 재계산
    const interval = setInterval(refreshToday, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', refreshToday)
      window.removeEventListener('focus', refreshToday)
      clearInterval(interval)
    }
  }, [])

  if (!today) {
    return (
      <section>
        <div className="mb-2 h-7" />
        <div className="card h-[300px] animate-pulse" />
      </section>
    )
  }
  return <CalendarBody today={today} />
}

function CalendarBody({ today }: { today: SeoulYMD }) {
  // 현재 보고 있는 연/월 — 마운트 시점의 오늘 기준으로 시작
  const [year, setYear] = useState(today.year)
  const [month, setMonth] = useState(today.month) // 0-indexed

  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [loading, setLoading] = useState(true)

  const isCurrentMonth = year === today.year && month === today.month

  // 월 이동
  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  function goToday() {
    setYear(today.year)
    setMonth(today.month)
  }

  // 달이 바뀔 때마다 해당 달 로그 fetch
  useEffect(() => {
    async function fetchLogs() {
      setLoading(true)
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 0)
      const { data } = await supabase
        .from('exercise_logs')
        .select('*, employee:employees(*)')
        .gte('log_date', toDateKey(start))
        .lte('log_date', toDateKey(end))
      setLogs((data as ExerciseLog[]) ?? [])
      setLoading(false)
    }
    fetchLogs()
  }, [year, month])

  const cells = getCalendarCells(year, month)

  // 날짜(day) -> 직원ID -> 색상
  const dotsByDay = useMemo(() => {
    const map = new Map<number, Map<string, string>>()
    for (const log of logs) {
      const d = new Date(log.log_date)
      const day = d.getDate()
      const inner = map.get(day) ?? new Map<string, string>()
      inner.set(log.employee_id, getEmployeeColor(log.employee))
      map.set(day, inner)
    }
    return map
  }, [logs])

  return (
    <section>
      {/* 헤더: < 연월 > + 오늘 버튼 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 transition active:bg-ink-100"
          >
            ‹
          </button>
          <span className="min-w-[72px] text-center text-sm font-bold text-ink-800">
            {year}년 {month + 1}월
          </span>
          <button
            onClick={nextMonth}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 transition active:bg-ink-100"
          >
            ›
          </button>
        </div>

        {!isCurrentMonth && (
          <button
            onClick={goToday}
            className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition active:bg-brand-100"
          >
            이번 달
          </button>
        )}
      </div>

      <div className={`card grid grid-cols-7 gap-1 text-center transition-opacity ${loading ? 'opacity-40' : ''}`}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[11px] font-medium text-ink-300">
            {w}
          </div>
        ))}
        {cells.map((day, idx) => {
          const dots = day ? dotsByDay.get(day) : undefined
          const isToday = isCurrentMonth && day !== null && day === today.day
          return (
            <div
              key={idx}
              className={`flex h-12 flex-col items-center justify-start rounded-xl pt-1 ${
                isToday ? 'bg-brand-50 ring-1 ring-inset ring-brand-300' : ''
              }`}
            >
              {day && (
                <span className={`text-[11px] ${isToday ? 'font-bold text-brand-700' : 'text-ink-500'}`}>
                  {day}
                </span>
              )}
              {dots && dots.size > 0 && (
                <div className="mt-0.5 flex max-w-[28px] flex-wrap justify-center gap-0.5">
                  {Array.from(dots.values())
                    .slice(0, 4)
                    .map((color, i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
