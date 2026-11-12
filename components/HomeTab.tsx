'use client'

// 홈 — 오늘의 운동 · 이번 주 기록 · 운동 달력
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useMe } from '@/lib/me'
import { koreanDate, useEngagement } from '@/lib/engagement'
import { Loading, NeedLogin, Notice, PageHead, Progress, Section, fmtMinutes } from '@/lib/ui'
import MiniCalendar from './MiniCalendar'

function seoulToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}
const DOW = ['월', '화', '수', '목', '금', '토', '일']

export default function HomeTab({ onRecord, onChallenge }: { onRecord: () => void; onChallenge: () => void }) {
  const { me, requireMe } = useMe()
  const { data, loading, error, needLogin } = useEngagement()
  const [teamToday, setTeamToday] = useState<number | null>(null)
  const today = data?.today ?? seoulToday()

  // 오늘 운동한 동료 수 (공개된 기록에서 사람 수만 셈)
  useEffect(() => {
    supabase.from('exercise_logs').select('employee_id').eq('log_date', seoulToday()).then(({ data: rows }) => {
      setTeamToday(new Set((rows ?? []).map((r) => r.employee_id)).size)
    })
  }, [])

  const todayRow = data?.week.days.find((d) => d.date === today)
  const maxMin = Math.max(30, ...(data?.week.days.map((d) => d.minutes) ?? [0]))

  return (
    <div>
      <PageHead title="오늘의 운동" sub={koreanDate(today)} />

      {/* 오늘 */}
      <div className="pb-6">
        {loading ? (
          <Loading lines={2} />
        ) : data && todayRow && todayRow.sessions > 0 ? (
          <p className="text-[22px] font-bold leading-snug tracking-[-0.02em] text-ink-900">
            {me?.name}님은 오늘{' '}
            <span className="num text-brand-600">{todayRow.sessions}회</span>
            {todayRow.minutes > 0 && <>, <span className="num text-brand-600">{fmtMinutes(todayRow.minutes)}</span></>} 운동했어요.
          </p>
        ) : (
          <p className="text-[22px] font-bold leading-snug tracking-[-0.02em] text-ink-900">
            {me ? `${me.name}님, 오늘 기록은 아직이에요.` : '오늘 운동하셨나요?'}
          </p>
        )}
        <p className="mt-2 text-[14px] text-ink-500">
          {teamToday === null ? ' ' : teamToday > 0 ? `오늘 동료 ${teamToday}명이 운동을 기록했어요.` : '오늘 첫 기록을 남겨 보세요.'}
        </p>
        <button type="button" onClick={onRecord} className="btn-primary mt-5">운동 기록하기</button>
      </div>

      {/* 이번 주 */}
      <Section title="이번 주 기록"
        action={data && <span className="text-[13px] tabular-nums text-ink-500">{data.week.start.slice(5).replace('-', '.')} – {data.week.end.slice(5).replace('-', '.')}</span>}>
        {needLogin ? (
          <NeedLogin text="본인 확인을 하면 이번 주 내 기록과 목표가 여기에 보여요." onLogin={() => requireMe()} />
        ) : loading ? (
          <Loading />
        ) : error ? (
          <Notice tone="error">{error}</Notice>
        ) : data ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <WeekStat value={data.week.sessions} unit="회" label="운동" />
              <WeekStat value={data.week.minutes} unit="분" label="인정 시간" />
              <WeekStat value={data.streak.current} unit="일" label="연속 운동" />
            </div>

            {/* 요일별 막대 (인정 시간 기준, 시간 없는 기록은 얇게 표시) */}
            <div className="mt-6 flex h-[92px] items-end gap-2" aria-hidden="true">
              {data.week.days.map((d, i) => {
                const h = d.minutes > 0 ? Math.max(8, Math.round((d.minutes / maxMin) * 64)) : d.sessions > 0 ? 6 : 2
                const isToday = d.date === today
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className={`w-full rounded-sm ${d.sessions > 0 ? 'bg-brand-600' : 'bg-ink-100'}`} style={{ height: h }} />
                    <span className={`text-[12px] ${isToday ? 'font-extrabold text-ink-900' : 'font-semibold text-ink-500'}`}>{DOW[i]}</span>
                  </div>
                )
              })}
            </div>
            <p className="sr-only">
              {data.week.days.map((d, i) => `${DOW[i]}요일 ${d.sessions}회 ${d.minutes}분`).join(', ')}
            </p>

            {/* 목표 */}
            <div className="mt-6">
              {data.goal ? (
                <>
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="text-[14px] font-bold text-ink-900">
                      이번 주 목표 {data.goal.target}{data.goal.kind === 'sessions' ? '회' : '분'}
                    </p>
                    <p className="text-[14px] font-bold tabular-nums text-brand-600">
                      {data.goal.value >= data.goal.target ? '달성' : `${Math.round((data.goal.value / data.goal.target) * 100)}%`}
                    </p>
                  </div>
                  <Progress value={data.goal.value} max={data.goal.target} label="이번 주 목표 달성률" />
                </>
              ) : (
                <button type="button" onClick={onChallenge} className="pill-action -ml-2.5 text-ink-900 underline">
                  주간 목표 정하기
                </button>
              )}
            </div>
          </>
        ) : null}
      </Section>

      {/* 달력 */}
      <Section title="운동 달력">
        <MiniCalendar refreshKey={0} />
      </Section>
    </div>
  )
}

function WeekStat({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <div>
      <p className="num text-[32px] leading-none text-ink-900">
        {value}<span className="ml-0.5 text-[14px] font-bold tracking-normal text-ink-500">{unit}</span>
      </p>
      <p className="mt-1.5 text-[13px] text-ink-500">{label}</p>
    </div>
  )
}
