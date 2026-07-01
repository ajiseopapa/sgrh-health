import { ExerciseLog } from '@/types/database'
import { getEmployeeColor } from '@/lib/colors'
import SectionTitle from './SectionTitle'

const MEDALS = ['🥇', '🥈', '🥉']

export default function TopRankingBoard({
  logs,
  loading,
}: {
  logs: ExerciseLog[]
  loading: boolean
}) {
  const countMap = new Map<string, { name: string; count: number; color: string }>()
  for (const log of logs) {
    if (!log.employee) continue
    const cur = countMap.get(log.employee_id) ?? {
      name: log.employee.name,
      count: 0,
      color: getEmployeeColor(log.employee),
    }
    cur.count += 1
    countMap.set(log.employee_id, cur)
  }

  const ranked = Array.from(countMap.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return (
    <section>
      <SectionTitle>🔥 이번 달 운동왕 TOP 3</SectionTitle>

      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />
      ) : ranked.length === 0 ? (
        <div className="card text-center text-sm text-ink-400">
          아직 이번 달 기록이 없어요.
          <br />
          첫 기록을 남겨보세요!
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {ranked.map((r, i) => (
            <div
              key={r.id}
              className={`flex flex-col items-center rounded-2xl px-2 py-4 ${
                i === 0 ? 'bg-accent-50 shadow-raised' : 'bg-white shadow-card'
              }`}
            >
              <span className="text-2xl">{MEDALS[i]}</span>
              <span
                className="mt-2 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: r.color }}
              >
                {r.name[0]}
              </span>
              <span className="mt-2 w-full truncate text-center text-sm font-semibold text-ink-800">
                {r.name}
              </span>
              <span className="mt-0.5 text-xs font-medium text-ink-400">{r.count}회</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
