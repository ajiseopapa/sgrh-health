import { ExerciseLog } from '@/types/database'
import { colorForId } from '@/lib/colors'

const MEDALS = ['🥇', '🥈', '🥉']

export default function TopRankingBoard({
  logs,
  loading,
}: {
  logs: ExerciseLog[]
  loading: boolean
}) {
  const countMap = new Map<string, { name: string; count: number }>()
  for (const log of logs) {
    if (!log.employee) continue
    const cur = countMap.get(log.employee_id) ?? { name: log.employee.name, count: 0 }
    cur.count += 1
    countMap.set(log.employee_id, cur)
  }

  const ranked = Array.from(countMap.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 mb-2">🔥 이번 달 운동왕 TOP 3</h2>

      {loading ? (
        <div className="h-20 rounded-xl bg-gray-100 animate-pulse" />
      ) : ranked.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center border rounded-xl">
          아직 이번 달 기록이 없어요. 첫 기록을 남겨보세요!
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {ranked.map((r, i) => (
            <div
              key={r.id}
              className="flex flex-col items-center rounded-xl border-2 py-3"
              style={{ borderColor: colorForId(r.id) }}
            >
              <span className="text-2xl">{MEDALS[i]}</span>
              <span
                className="mt-1 w-2 h-2 rounded-full"
                style={{ backgroundColor: colorForId(r.id) }}
              />
              <span className="text-sm font-medium mt-1 truncate w-full text-center px-1">
                {r.name}
              </span>
              <span className="text-xs text-gray-400">{r.count}회</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
