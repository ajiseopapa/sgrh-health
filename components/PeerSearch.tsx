'use client'

// 동료 기록 찾기 — v2.0 기록 탭의 "직원 검색해 기록 보기"를 피드로 옮긴 것.
// 공개 범위는 그대로: 피드에 이미 보이는 운동 기록(이름·종목·시간·거리·메모)만, 공개 키로 읽습니다.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ExerciseLog, formatDuration } from '@/types/database'
import { Empty, Icon, Loading } from '@/lib/ui'

interface Emp { id: string; name: string; employee_number: string }
const PAGE = 30

export default function PeerSearch() {
  const [open, setOpen] = useState(false)
  const [emps, setEmps] = useState<Emp[]>([])
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Emp | null>(null)
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || emps.length) return
    supabase.from('employees').select('id, name, employee_number').order('name').then(({ data }) => setEmps((data as Emp[]) ?? []))
  }, [open, emps.length])

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s || picked) return []
    return emps.filter((e) => e.name.toLowerCase().includes(s) || e.employee_number?.toLowerCase().includes(s)).slice(0, 6)
  }, [q, emps, picked])

  async function load(emp: Emp, from = 0) {
    setLoading(true); setError('')
    const { data, error: e } = await supabase
      .from('exercise_logs')
      .select('id, log_date, duration_seconds, duration_minutes, distance_km, memo, exercise_type:exercise_types(name, icon)')
      .eq('employee_id', emp.id)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    setLoading(false)
    if (e) { setError('기록을 불러오지 못했어요.'); return }
    const rows = (data as unknown as ExerciseLog[]) ?? []
    setLogs((p) => (from === 0 ? rows : [...p, ...rows]))
    setMore(rows.length === PAGE)
  }

  // 불러온 기록 기준 요약 (전체를 다 불러오기 전에는 '불러온 n건 기준'으로 표시)
  const summary = useMemo(() => {
    let sec = 0, km = 0
    const byType = new Map<string, number>()
    for (const l of logs) {
      sec += l.duration_seconds ?? (l.duration_minutes ? l.duration_minutes * 60 : 0)
      km += Number(l.distance_km ?? 0)
      const n = l.exercise_type?.name ?? '기타'
      byType.set(n, (byType.get(n) ?? 0) + 1)
    }
    return { sec, km, types: [...byType.entries()].sort((a, b) => b[1] - a[1]) }
  }, [logs])

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="pill-action -ml-2.5 mb-2 text-ink-900 underline">
        동료 기록 찾기
      </button>
    )
  }

  return (
    <div className="mb-6 border-y border-line py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[15px] font-bold text-ink-900">동료 기록 찾기</p>
        <button type="button" aria-label="동료 기록 찾기 닫기" onClick={() => { setOpen(false); setPicked(null); setQ(''); setLogs([]) }}
          className="-mr-2.5 flex h-11 w-11 items-center justify-center rounded-lg text-ink-700 active:bg-ink-50">
          <Icon name="close" size={20} />
        </button>
      </div>

      {picked ? (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[16px] font-bold text-ink-900">{picked.name}<span className="ml-1 text-[13px] font-normal text-ink-500">#{picked.employee_number}</span></p>
          <button type="button" onClick={() => { setPicked(null); setLogs([]); setQ('') }} className="pill-action -mr-2.5 text-ink-700 underline">다른 사람</button>
        </div>
      ) : (
        <div className="relative">
          <label className="sr-only" htmlFor="peer-q">이름 또는 사번</label>
          <input id="peer-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 또는 사번" className="input-field" autoComplete="off" />
          {matches.length > 0 && (
            <ul className="mt-1 divide-y divide-line border border-ink-200 bg-sheet">
              {matches.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => { setPicked(e); load(e) }} className="flex min-h-[44px] w-full items-center px-3 text-left text-[15px] text-ink-900 active:bg-ink-50">
                    {e.name}<span className="ml-1 text-[13px] text-ink-500">#{e.employee_number}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {picked && (
        <>
          {logs.length > 0 && (
            <div className="mb-3 text-[14px] text-ink-700">
              <p>
                <span className="font-bold text-ink-900">{logs.length}{more ? '+' : ''}회</span>
                {summary.sec > 0 && <> · {formatDuration(summary.sec)}</>}
                {summary.km > 0 && <> · {summary.km.toFixed(1)}km</>}
                {more && <span className="text-ink-500"> (불러온 기록 기준)</span>}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-500">{summary.types.map(([n, c]) => `${n} ${c}회`).join(' · ')}</p>
            </div>
          )}
          {error && <p role="alert" className="text-[14px] font-semibold text-red-700">{error}</p>}
          {!loading && logs.length === 0 && !error && <Empty title="아직 남긴 기록이 없어요." />}
          <ul className="divide-y divide-line">
            {logs.map((l) => {
              const sec = l.duration_seconds ?? (l.duration_minutes ? l.duration_minutes * 60 : 0)
              return (
                <li key={l.id} className="flex gap-3 py-2.5 text-[14px]">
                  <span className="w-[48px] shrink-0 tabular-nums text-ink-500">{l.log_date.slice(5).replace('-', '.')}</span>
                  <span className="min-w-0 flex-1 text-ink-800">
                    <span aria-hidden="true" className="mr-1">{l.exercise_type?.icon}</span>{l.exercise_type?.name}
                    <span className="tabular-nums text-ink-600">{sec ? ` · ${formatDuration(sec)}` : ' · 시간 기록 없음'}{l.distance_km ? ` · ${Number(l.distance_km).toFixed(2)}km` : ''}</span>
                    {l.memo && <span className="block text-[13px] text-ink-500">{l.memo}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
          {loading && <Loading lines={2} />}
          {more && !loading && <button type="button" onClick={() => load(picked, logs.length)} className="btn-secondary mt-3 w-full">더 보기</button>}
        </>
      )}
    </div>
  )
}
