'use client'

// 홈 — 오늘의 운동 · 이번 주 기록 · 운동 달력
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useMe } from '@/lib/me'
import { koreanDate, useEngagement } from '@/lib/engagement'
import { Icon, Loading, NeedLogin, Notice, Progress, Section, fmtMinutes } from '@/lib/ui'
import MiniCalendar from './MiniCalendar'
import ReminderSettings from './ReminderSettings'
import { HomeProfile } from './Profile'
import { TreeArt } from './GardenPanel'
import { api } from '@/lib/api'

function seoulToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}
const DOW = ['월', '화', '수', '목', '금', '토', '일']

type Tree = { stage: number; name: string; activeDays: number; next: { name: string; remaining: number } | null }

export default function HomeTab({ onRecord, onChallenge, onTree }: { onRecord: () => void; onChallenge: () => void; onTree: () => void }) {
  const { me, requireMe } = useMe()
  const { data, loading, error, needLogin } = useEngagement()
  const [teamToday, setTeamToday] = useState<number | null>(null)
  const today = data?.today ?? seoulToday()
  const [tree, setTree] = useState<Tree | null>(null)

  // 나의 나무 — 운동한 날이 쌓이면 자람(서버 계산). 본인 확인 전에는 안 보임
  useEffect(() => {
    if (!me) { setTree(null); return }
    api<{ tree?: Tree }>('/api/me/game').then((r) => setTree(r.ok && r.data.tree ? r.data.tree : null))
  }, [me])

  // 오늘 운동한 동료 수 (공개된 기록에서 사람 수만 셈)
  useEffect(() => {
    const t = seoulToday()
    supabase.rpc('calendar_month_summary', { p_month: `${t.slice(0, 7)}-01` }).then(({ data: m }) => {
      const day = (m as { days?: { d: string; p: number }[] } | null)?.days?.find((d) => d.d === t)
      setTeamToday(day?.p ?? 0)
    })
  }, [])

  const todayRow = data?.week.days.find((d) => d.date === today)
  const maxMin = Math.max(30, ...(data?.week.days.map((d) => d.minutes) ?? [0]))

  const todayDone = !!(data && todayRow && todayRow.sessions > 0)

  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:pt-2">
      {/* 오늘 — 연두 색 면으로 가장 먼저 눈에 들어오게 */}
      <section className="-mx-5 mb-2 bg-brand-300 px-5 pb-6 pt-5 text-ink-900 lg:mx-0 lg:rounded-2xl lg:p-8">
        {me && <div className="mb-3"><HomeProfile name={me.name} /></div>}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-ink-700">오늘의 움직임이 내일의 성장으로</p>
            <p className="mt-2 text-[14px] font-bold tabular-nums">{koreanDate(today)}</p>
            <h1 className="mt-1 whitespace-nowrap text-[34px] font-black leading-[1.05] tracking-[-0.04em]">오늘의 운동</h1>
          </div>
          {tree && (
            <button type="button" onClick={onTree} aria-label={`나의 나무: ${tree.name}, 운동한 날 ${tree.activeDays}일. 자세히 보기`}
              className="-mb-1 -mr-1 flex shrink-0 flex-col items-center rounded-xl px-1 pt-1 active:bg-brand-400/40">
              <TreeArt stage={tree.stage} size={72} />
              <span className="mt-1 text-[12px] font-bold text-ink-900">{tree.name} · <span className="tabular-nums">{tree.activeDays}일</span></span>
              {tree.next && <span className="max-w-[120px] text-center text-[11px] font-semibold leading-snug text-ink-700">{tree.next.remaining}일 더 운동하면 {tree.next.name}</span>}
            </button>
          )}
        </div>

        <div className="mt-6 min-h-[92px]">
          {loading ? (
            <Loading lines={2} />
          ) : todayDone ? (
            <>
              <p className="flex items-end gap-4">
                <span className="num text-[72px] leading-[0.85]">{todayRow!.sessions}<span className="ml-1 text-[22px] font-black tracking-normal">회</span></span>
                {todayRow!.minutes > 0 && (
                  <span className="num pb-1 text-[34px] leading-none">{todayRow!.minutes}<span className="ml-0.5 text-[18px] font-black tracking-normal">분</span></span>
                )}
              </p>
              <p className="mt-3 text-[16px] font-bold">{me?.name}님, 오늘도 해냈어요.</p>
            </>
          ) : (
            <>
              <p className="num text-[72px] leading-[0.85]">0<span className="ml-1 text-[22px] font-black tracking-normal">회</span></p>
              <p className="mt-3 text-[16px] font-bold">{me ? `${me.name}님, 오늘 첫 기록을 남겨 볼까요?` : '오늘 운동하셨나요?'}</p>
            </>
          )}
        </div>

        <p className="mt-1 text-[14px] font-semibold text-ink-700">
          {teamToday === null ? '\u00a0' : teamToday > 0 ? `지금까지 동료 ${teamToday}명이 운동했어요` : '아직 아무도 기록하지 않았어요'}
        </p>
        <button type="button" onClick={onRecord}
          className="mt-5 flex min-h-[52px] w-full items-center justify-between rounded-lg bg-ink-900 px-5 text-[16px] font-bold text-paper active:bg-ink-700">
          운동 기록하기
          <Icon name="chevron-right" size={20} />
        </button>
      </section>

      {/* 이번 주 */}
      <Section title="이번 주" className="border-t-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-2"
        action={data && <span className="text-[13px] font-semibold tabular-nums text-ink-500">{data.week.start.slice(5).replace('-', '.')} – {data.week.end.slice(5).replace('-', '.')}</span>}>
        {needLogin ? (
          <NeedLogin text="본인 확인을 하면 이번 주 내 기록과 목표가 여기에 보여요." onLogin={() => requireMe()} />
        ) : loading ? (
          <Loading />
        ) : error ? (
          <Notice tone="error">{error}</Notice>
        ) : data ? (
          <>
            <div className="flex items-end justify-between gap-4">
              <p className="num text-[56px] leading-[0.9] text-ink-900">
                {data.week.sessions}<span className="ml-1 text-[18px] font-black tracking-normal text-ink-500">회</span>
              </p>
              <p className="pb-1 text-right text-[15px] font-bold text-ink-700">
                인정 시간<br /><span className="num text-[24px] text-ink-900">{fmtMinutes(data.week.minutes)}</span>
              </p>
            </div>

            {/* 요일별 막대: 운동한 날은 차콜, 오늘은 연두 */}
            <div className="mt-9 flex h-[110px] items-end gap-2" aria-hidden="true">
              {data.week.days.map((d, i) => {
                const h = d.minutes > 0 ? Math.max(14, Math.round((d.minutes / maxMin) * 84)) : d.sessions > 0 ? 10 : 4
                const isToday = d.date === today
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                    {d.minutes > 0 && <span className="text-[11px] font-bold tabular-nums text-ink-600">{d.minutes}</span>}
                    <div className={`w-full rounded-md ${d.sessions > 0 ? (isToday ? 'bg-brand-300 ring-2 ring-ink-900' : 'bg-ink-900') : 'bg-ink-100'}`} style={{ height: h }} />
                    <span className={`text-[13px] ${isToday ? 'font-black text-ink-900' : 'font-semibold text-ink-500'}`}>{DOW[i]}</span>
                  </div>
                )
              })}
            </div>
            <p className="sr-only">
              {data.week.days.map((d, i) => `${DOW[i]}요일 ${d.sessions}회 ${d.minutes}분`).join(', ')}
            </p>

            {/* 목표 */}
            <div className="mt-7">
              {data.goal ? (
                <>
                  <div className="mb-2.5 flex items-baseline justify-between">
                    <p className="text-[15px] font-bold text-ink-900">
                      목표 {data.goal.target}{data.goal.kind === 'sessions' ? '회' : '분'}
                    </p>
                    <p className="num text-[22px] text-ink-900">
                      {data.goal.value >= data.goal.target ? <span className="mark">달성!</span> : `${Math.round((data.goal.value / data.goal.target) * 100)}%`}
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

            {/* 연속 운동: 차콜 면으로 리듬을 줌 */}
            {data.streak.current > 0 && (
              <div className="mt-7 flex items-center justify-between rounded-lg bg-ink-900 px-5 py-4 text-paper">
                <p className="text-[15px] font-bold">연속 운동</p>
                <p className="num text-[36px] leading-none text-brand-300">
                  {data.streak.current}<span className="ml-1 text-[16px] font-black tracking-normal text-paper">일째</span>
                </p>
              </div>
            )}
          </>
        ) : null}
      </Section>

      {/* 달력 */}
      <Section title="운동 달력" className="lg:border-t-0">
        <MiniCalendar refreshKey={0} />
      </Section>

      {/* 운동 알람 */}
      <Section title="운동 알람" className="lg:col-start-1">
        <ReminderSettings />
      </Section>
    </div>
  )
}

