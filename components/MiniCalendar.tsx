'use client'

import { useMemo, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ExerciseLog } from '@/types/database'
import { getEmployeeColor } from '@/lib/colors'
import { getCalendarCells, toDateKey } from '@/lib/dateUtils'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function MiniCalendar() {
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));

  // 현재 보고 있는 연/월
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed

  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [loading, setLoading] = useState(true)

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

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
    setYear(today.getFullYear())
    setMonth(today.getMonth())
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
          const isToday = isCurrentMonth && day === today.getDate()
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
