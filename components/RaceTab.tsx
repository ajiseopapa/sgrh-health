'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Race } from '@/types/database'
import { daysUntil, formatRaceDate, registrationStatus } from '@/lib/races'
import SectionTitle from './SectionTitle'

export default function RaceTab() {
  const [races, setRaces] = useState<Race[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('races')
      .select('*')
      .order('race_date')
      .then(({ data }) => {
        setRaces(data ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-ink-100" />

  const upcoming = races.filter((r) => daysUntil(r.race_date) >= 0)
  const past = races
    .filter((r) => daysUntil(r.race_date) < 0)
    .sort((a, b) => b.race_date.localeCompare(a.race_date))

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
          <div className="card text-center text-sm text-ink-400">
            예정된 대회가 없어요.<br />
            <span className="text-xs">관리자가 설정 &gt; 대회 관리에서 추가할 수 있어요.</span>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {upcoming.map((race) => {
              const d = daysUntil(race.race_date)
              const isSoon = d <= 14
              const distances = race.distances.split(',').map((s) => s.trim()).filter(Boolean)
              const regStatus = registrationStatus(race.registration_deadline)
              return (
                <li key={race.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink-900">{race.name}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{formatRaceDate(race.race_date)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          isSoon ? 'bg-accent-50 text-accent-600' : 'bg-brand-50 text-brand-700'
                        }`}
                      >
                        {d === 0 ? 'D-DAY' : `D-${d}`}
                      </span>
                      {regStatus === 'closed' && (
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-500">
                          접수 마감
                        </span>
                      )}
                      {regStatus === 'closing' && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-500">
                          접수 D-{daysUntil(race.registration_deadline!)}
                        </span>
                      )}
                      {regStatus === 'open' && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                          접수중
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
                    <span>📍</span>
                    <span>{race.location}</span>
                  </div>

                  {distances.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {distances.map((dist) => (
                        <span
                          key={dist}
                          className="rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-600"
                        >
                          {dist}
                        </span>
                      ))}
                    </div>
                  )}

                  {race.source_url && (
                    <a
                      href={race.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500 transition active:bg-ink-100"
                    >
                      <span>{race.source_name ?? '출처'}에서 자세히 보기</span>
                      <span>↗</span>
                    </a>
                  )}
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
                  <p className="text-xs text-ink-400">{formatRaceDate(race.race_date)} · {race.location}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-[11px] text-ink-300">
        대회 정보는 관리자가 설정 &gt; 대회 관리에서 직접 추가·수정해요.
      </p>
    </div>
  )
}
