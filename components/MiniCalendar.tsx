import { useMemo } from 'react'
import { ExerciseLog } from '@/types/database'
import { colorForId } from '@/lib/colors'
import { getCalendarCells } from '@/lib/dateUtils'

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
      <h2 className="text-sm font-semibold text-gray-500 mb-2">
        📅 {today.getMonth() + 1}월 운동 캘린더
      </h2>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[11px] text-gray-400">
            {w}
          </div>
        ))}
        {cells.map((day, idx) => {
          const dots = day ? dotsByDay.get(day) : undefined
          const isToday = day === today.getDate()
          return (
            <div
              key={idx}
              className={`h-12 rounded-lg flex flex-col items-center justify-start pt-1 ${
                day ? 'bg-gray-50' : ''
              } ${isToday ? 'ring-1 ring-brand-500' : ''}`}
            >
              {day && <span className="text-[11px] text-gray-600">{day}</span>}
              {dots && dots.size > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-0.5 max-w-[28px]">
                  {Array.from(dots.values())
                    .slice(0, 4)
                    .map((color, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
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
