import { useMemo } from 'react'
import { ExerciseLog } from '@/types/database'
import { colorForId } from '@/lib/colors'
import { getCalendarCells } from '@/lib/dateUtils'
import SectionTitle from './SectionTitle'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function MiniCalendar({ logs }: { logs: ExerciseLog[] }) {
  const today = new Date()
  const cells = getCalendarCells(today.getFullYear(), today.getMonth())

  // 날짜(day) -> 직원ID -> 색상
  const dotsByDay = useMemo(() => {
    const map = new Map<number, Map<string, string>>()
    for (const log of logs) {
      const d = new Date(log.log_date)
      if (d.getMonth() !== today.getMonth() || d.getFullYear() !== today.getFullYear()) continue
      const day = d.getDate()
      const inner = map.get(day) ?? new Map<string, string>()
      inner.set(log.employee_id, colorForId(log.employee_id))
      map.set(day, inner)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs])

  return (
    <section>
      <SectionTitle>📅 {today.getMonth() + 1}월 운동 캘린더</SectionTitle>
      <div className="card grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[11px] font-medium text-ink-300">
            {w}
          </div>
        ))}
        {cells.map((day, idx) => {
          const dots = day ? dotsByDay.get(day) : undefined
          const isToday = day === today.getDate()
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
