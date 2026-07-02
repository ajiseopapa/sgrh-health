'use client'

import { RACES, daysUntil, formatRaceDate } from '@/lib/races'
import SectionTitle from './SectionTitle'

export default function RaceTab() {
  const upcoming = RACES
    .filter((r) => daysUntil(r.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  const past = RACES
    .filter((r) => daysUntil(r.date) < 0)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-6">
      <div className="card bg-gradient-to-br from-brand-600 to-brand-700 text-white">
        <p className="text-sm font-bold">🏃‍♂️ 부산 러닝 대회 캘린더</p>
        <p className="mt-1 text-xs text-brand-100">
          부산에서 열리는 마라톤·러닝 대회 정보예요. 팀원들과 함께 도전해보세요!
        </p>
      </div>

      {/* 다가오는 대회 */}
      <section>
        <SectionTitle>다가오는 대회 ({upcoming.length})</SectionTitle>
        {upcoming.length === 0 ? (
          <div className="card text-center text-sm text-ink-400">예정된 대회가 없어요.</div>
        ) : (
          <ul className="space-y-2.5">
            {upcoming.map((race) => {
              const d = daysUntil(race.date)
              const isSoon = d <= 14
              return (
                <li key={race.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink-900">{race.name}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{formatRaceDate(race.date)}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                        isSoon ? 'bg-accent-50 text-accent-600' : 'bg-brand-50 text-brand-700'
                      }`}
                    >
                      {d === 0 ? 'D-DAY' : `D-${d}`}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
                    <span>📍</span>
                    <span>{race.location}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {race.distances.map((dist) => (
                      <span
                        key={dist}
                        className="rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-600"
                      >
                        {dist}
                      </span>
                    ))}
                  </div>

                  <a
                    href={race.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500 transition active:bg-ink-100"
                  >
                    <span>{race.sourceName}에서 자세히 보기</span>
                    <span>↗</span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* 지난 대회 */}
      {past.length > 0 && (
        <section>
          <SectionTitle>지난 대회</SectionTitle>
          <ul className="card divide-y divide-ink-100 p-0">
            {past.map((race) => (
              <li key={race.id} className="flex items-center justify-between px-4 py-3 opacity-60">
                <div>
                  <p className="text-sm font-medium text-ink-700">{race.name}</p>
                  <p className="text-xs text-ink-400">{formatRaceDate(race.date)} · {race.location}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-[11px] text-ink-300">
        대회 정보는 수동으로 관리돼요. 최신 정보는 각 출처 링크에서 확인해주세요.
      </p>
    </div>
  )
}
