'use client'

// 기록 — 운동 남기기 + 내 기록 (본인 기록만. 동료 기록은 피드에서)
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ExerciseLog, ExerciseType, formatDuration } from '@/types/database'
import { api } from '@/lib/api'
import { useMe } from '@/lib/me'
import { useDialog } from '@/lib/dialog'
import { useEngagement } from '@/lib/engagement'
import { Empty, Loading, NeedLogin, Notice, PageHead, Section, fmtMinutes } from '@/lib/ui'
import ExerciseLogForm from './ExerciseLogForm'

const PAGE = 20

export default function RecordTab() {
  const { me, mustChangePin, requireMe } = useMe()
  const dialog = useDialog()
  const [types, setTypes] = useState<ExerciseType[]>([])
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const { data: eng } = useEngagement(refresh)

  useEffect(() => {
    supabase.from('exercise_types').select('*').order('name').then(({ data }) => setTypes(data ?? []))
  }, [])

  const loadLogs = useCallback(async (from = 0) => {
    if (!me) { setLogs([]); return }
    setLoading(true); setError('')
    const { data, error: e } = await supabase
      .from('exercise_logs')
      .select('*, exercise_type:exercise_types(*)')
      .eq('employee_id', me.id)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    setLoading(false)
    if (e) { setError('내 기록을 불러오지 못했어요.'); return }
    const rows = (data as ExerciseLog[]) ?? []
    setLogs((prev) => (from === 0 ? rows : [...prev, ...rows]))
    setMore(rows.length === PAGE)
  }, [me])

  useEffect(() => { loadLogs(0) }, [loadLogs, refresh])

  async function remove(log: ExerciseLog) {
    const ok = await dialog.confirm({
      title: '이 기록을 삭제할까요?',
      message: `${log.log_date} ${log.exercise_type?.name ?? '운동'} 기록이 지워지고, 목표·챌린지·배지도 다시 계산돼요.`,
      confirmText: '삭제',
      tone: 'danger',
    })
    if (!ok) return
    const r = await api(`/api/logs/${log.id}`, { method: 'DELETE' })
    if (!r.ok) { setError(r.message || '삭제하지 못했어요.'); return }
    setRefresh((k) => k + 1)
  }

  return (
    <div>
      <PageHead title="기록" />

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10">
      <div className="pb-8">
        <ExerciseLogForm exerciseTypes={types} onSuccess={() => setRefresh((k) => k + 1)} />
      </div>

      <Section title="내 기록" className="lg:border-t-0 lg:pt-0">
        {!me || mustChangePin ? (
          <NeedLogin text="본인 확인을 하면 내가 남긴 기록만 모아서 볼 수 있어요." onLogin={() => requireMe()} />
        ) : (
          <>
            {eng && (
              <dl className="mb-5 grid grid-cols-3 gap-4">
                <div><dt className="text-[13px] text-ink-500">전체</dt><dd className="num mt-1 text-[24px] leading-none">{eng.total.sessions}<span className="ml-0.5 text-[13px] font-bold text-ink-500">회</span></dd></div>
                <div><dt className="text-[13px] text-ink-500">인정 시간</dt><dd className="mt-1 text-[16px] font-extrabold leading-6 tabular-nums">{fmtMinutes(eng.total.minutes)}</dd></div>
                <div><dt className="text-[13px] text-ink-500">최장 연속</dt><dd className="num mt-1 text-[24px] leading-none">{eng.streak.longest}<span className="ml-0.5 text-[13px] font-bold text-ink-500">일</span></dd></div>
              </dl>
            )}
            {error && <div className="mb-3"><Notice tone="error">{error}</Notice></div>}
            {logs.length === 0 && !loading ? (
              <Empty title="아직 남긴 기록이 없어요." desc="위에서 첫 운동을 기록해 보세요." />
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {logs.map((l) => {
                  const sec = l.duration_seconds ?? (l.duration_minutes ? l.duration_minutes * 60 : 0)
                  return (
                    <li key={l.id} className="flex items-start gap-3 py-3.5">
                      <span className="w-[52px] shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums text-ink-500">
                        {l.log_date.slice(5).replace('-', '.')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-ink-900">
                          <span aria-hidden="true" className="mr-1">{l.exercise_type?.icon}</span>{l.exercise_type?.name ?? '운동'}
                        </p>
                        <p className="mt-0.5 text-[14px] tabular-nums text-ink-600">
                          {sec ? formatDuration(sec) : '시간 기록 없음'}
                          {l.distance_km ? ` · ${Number(l.distance_km).toFixed(2)}km` : ''}
                        </p>
                        {l.memo && <p className="mt-1 text-[14px] text-ink-500">{l.memo}</p>}
                      </div>
                      <button type="button" onClick={() => remove(l)} className="pill-action -mr-2.5 text-ink-500">삭제</button>
                    </li>
                  )
                })}
              </ul>
            )}
            {loading && <Loading lines={2} />}
            {more && !loading && (
              <button type="button" onClick={() => loadLogs(logs.length)} className="btn-secondary mt-4 w-full">더 보기</button>
            )}
          </>
        )}
      </Section>
      </div>
    </div>
  )
}
