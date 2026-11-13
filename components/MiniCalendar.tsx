'use client'

// 집계형 달력 — 직원별 색 점 대신 날짜별 참여 인원과 참여율 색 농도를 보여줍니다.
// 직원 수가 늘어도 한 칸에 숫자 하나만 들어가므로 가독성이 유지됩니다.
// (직원별 색상 정보 자체는 삭제하지 않았고, 피드·랭킹 등에서는 그대로 씁니다)
import { useMemo, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getCalendarCells } from '@/lib/dateUtils'
import DayDetail from './CalendarDayDetail'
import { Icon } from '@/lib/ui'

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

export default function MiniCalendar({ refreshKey = 0 }: { refreshKey?: number }) {
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
    document.addEventListener('visibilitychange', refreshToday)
    window.addEventListener('focus', refreshToday)
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
        <div className="card h-[340px] animate-pulse" />
      </section>
    )
  }
  return <CalendarBody today={today} refreshKey={refreshKey} />
}

export interface DaySummary {
  d: string // 'YYYY-MM-DD'
  p: number // 참여 인원 (같은 직원 여러 번 = 1명)
  n: number // 기록 수
  s: number // 총 운동 시간(초)
  h?: number | null // 그날까지 등록된 직원 수 = 그날 참여율 분모. 020 응답에는 없음 → 월 분모로 대신함
}

// 그날 참여율 분모: 날짜별 값(021)이 있으면 그것, 없으면 월 분모(020 호환)
export function dayHeadcount(info: DaySummary | undefined, monthHeadcount: number | null): number | null {
  return info && info.h !== undefined ? info.h : monthHeadcount
}

interface MonthSummary {
  headcount: number | null // 참여율 분모. 없으면(0명·미확인) null → "인원 정보 없음", 색 농도 안 씀
  headcount_basis?: HeadcountBasis // 분모 기준. 020(이전 버전) 응답에는 없음 → registered로 봄
  days: DaySummary[]
}

// 분모 기준별 화면 문구. 인사팀 재직 인원 자료로 바뀌면 DB가 'hr'을 돌려주고 문구만 자동으로 바뀝니다.
export type HeadcountBasis = 'registered' | 'hr'
export const BASIS_LABEL: Record<HeadcountBasis, { rate: string; count: string }> = {
  registered: { rate: '등록 직원 기준 참여율', count: '등록 직원' },
  hr: { rate: '재직 인원 기준 참여율', count: '재직' },
}

// 참여율 → 색 단계 (0: 기록 없음, 1~4: 농도, -1: 재직 인원 정보 없음)
export function levelOf(p: number, headcount: number | null): number {
  if (!p) return 0
  if (!headcount) return -1
  const r = p / headcount
  if (r < 0.25) return 1
  if (r < 0.5) return 2
  if (r < 0.75) return 3
  return 4
}

const LEVEL_STYLE: Record<number, string> = {
  0: 'text-ink-600',
  [-1]: 'bg-ink-100 text-ink-800',
  1: 'bg-brand-100 text-ink-900',
  2: 'bg-brand-200 text-ink-900',
  3: 'bg-brand-300 text-ink-900',
  4: 'bg-ink-900 text-brand-300',
}

const LEGEND_SWATCH: Record<number, string> = {
  1: 'bg-brand-100',
  2: 'bg-brand-200',
  3: 'bg-brand-300',
  4: 'bg-ink-900',
}

const LEGEND = [
  { level: 1, label: '~24%' },
  { level: 2, label: '~49%' },
  { level: 3, label: '~74%' },
  { level: 4, label: '75%~' },
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function CalendarBody({ today, refreshKey }: { today: SeoulYMD; refreshKey: number }) {
  const [year, setYear] = useState(today.year)
  const [month, setMonth] = useState(today.month) // 0-indexed
  const [summary, setSummary] = useState<MonthSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<number | null>(null)

  const isCurrentMonth = year === today.year && month === today.month

  function prevMonth() {
    setSelected(null)
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    setSelected(null)
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }
  function goToday() {
    setSelected(null)
    setYear(today.year)
    setMonth(today.month)
  }

  // 날짜별 집계만 서버(DB 함수)에서 받아옴 — 기록이 많아도 1,000건 제한에 걸리지 않음
  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.rpc('calendar_month_summary', { p_month: `${year}-${pad(month + 1)}-01` })
    if (error) {
      setError('달력 정보를 불러오지 못했어요.')
      setSummary(null)
    } else {
      setSummary(data as MonthSummary)
    }
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetchSummary() }, [fetchSummary, refreshKey])

  const byDay = useMemo(() => {
    const map = new Map<number, DaySummary>()
    for (const d of summary?.days ?? []) map.set(Number(d.d.slice(8, 10)), d)
    return map
  }, [summary])

  const cells = getCalendarCells(year, month)
  const headcount = summary?.headcount ?? null
  const basis = BASIS_LABEL[summary?.headcount_basis ?? 'registered']
  const selectedDate = selected ? `${year}-${pad(month + 1)}-${pad(selected)}` : null

  return (
    <section>
      {/* 헤더: < 연월 > + 이번 달 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="-ml-2.5 flex items-center">
          <button
            onClick={prevMonth}
            aria-label="이전 달"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-700 transition active:bg-ink-50"
          >
            <Icon name="chevron-left" size={20} />
          </button>
          <span className="min-w-[88px] text-center text-[15px] font-bold tabular-nums text-ink-900">
            {year}년 {month + 1}월
          </span>
          <button
            onClick={nextMonth}
            aria-label="다음 달"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-700 transition active:bg-ink-50"
          >
            <Icon name="chevron-right" size={20} />
          </button>
        </div>

        {!isCurrentMonth && (
          <button
            onClick={goToday}
            className="pill-action text-ink-900 underline"
          >
            이번 달
          </button>
        )}
      </div>

      <div className={`transition-opacity ${loading ? 'opacity-40' : ''}`}>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1.5 text-[12px] font-semibold text-ink-500">
              {w}
            </div>
          ))}
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="h-[52px]" />
            const info = byDay.get(day)
            const level = levelOf(info?.p ?? 0, dayHeadcount(info, headcount))
            const isToday = isCurrentMonth && day === today.day
            const isSelected = selected === day
            const isFuture =
              year > today.year ||
              (year === today.year && (month > today.month || (month === today.month && day > today.day)))
            return (
              <button
                key={idx}
                type="button"
                disabled={isFuture}
                onClick={() => setSelected(isSelected ? null : day)}
                aria-label={`${month + 1}월 ${day}일${info ? `, ${info.p}명 참여` : ', 기록 없음'}`}
                aria-pressed={isSelected}
                className={`flex h-[52px] flex-col items-center justify-center rounded-md transition disabled:cursor-default disabled:opacity-35 ${
                  LEVEL_STYLE[level]
                } ${isSelected ? 'ring-2 ring-inset ring-ink-900' : isToday ? 'ring-[1.5px] ring-inset ring-ink-900/70' : ''}`}
              >
                <span className={`text-[14px] leading-none tabular-nums ${isToday ? 'font-extrabold' : 'font-semibold'}`}>{day}</span>
                {info && info.p > 0 && (
                  <span className="mt-1 text-[11px] font-bold leading-none tabular-nums">{info.p}명</span>
                )}
              </button>
            )
          })}
        </div>

        {/* 범례 */}
        <div className="mt-4 space-y-1.5">
          {headcount ? (
            <>
              <p className="text-[12px] font-semibold text-ink-700">
                {basis.rate} <span className="font-normal text-ink-500">· {basis.count} {headcount}명({isCurrentMonth ? '오늘' : '말일'} 기준)</span>
              </p>
              <div className="flex items-center gap-3">
                {LEGEND.map((l) => (
                  <span key={l.level} className="flex items-center gap-1 text-[12px] tabular-nums text-ink-500">
                    <span className={`h-3 w-3 rounded-sm ${LEGEND_SWATCH[l.level]}`} />
                    {l.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[12px] text-ink-500">
              <span className="font-semibold text-ink-700">인원 정보 없음</span> · 숫자는 그날 운동한 인원이에요. 참여율 색은 표시하지 않아요.
            </p>
          )}
          <p className="text-[12px] text-ink-500">날짜를 누르면 그날 기록을 볼 수 있어요.</p>
        </div>
        {error && <p role="alert" className="mt-2 text-[14px] font-semibold text-red-700">{error}</p>}
      </div>

      {selectedDate && (
        <DayDetail
          date={selectedDate}
          summary={selected ? byDay.get(selected) : undefined}
          headcount={dayHeadcount(selected ? byDay.get(selected) : undefined, headcount)}
          rateLabel={basis.rate}
          refreshKey={refreshKey}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  )
}
