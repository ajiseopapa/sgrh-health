'use client'

// 내 운동 현황(/api/me/engagement)을 홈·기록·도전 화면이 같이 씁니다.
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { useMe } from './me'

export interface Engagement {
  today: string
  week: { start: string; end: string; sessions: number; minutes: number; activeDays: number; days: { date: string; sessions: number; minutes: number }[] }
  goal: { kind: 'sessions' | 'minutes'; target: number; value: number } | null
  goalSetThisWeek: boolean
  streak: { current: number; longest: number }
  total: { sessions: number; minutes: number; activeDays: number }
  badges: {
    earned: { key: string; label: string; condition: string; series: string; awarded_at: string }[]
    next: { series: string; seriesLabel: string; current: number; next: { key: string; label: string; condition: string; threshold: number } | null }[]
  }
  challenges: {
    id: string; title: string; description: string | null; metric: 'sessions' | 'minutes' | 'active_days'; target: number
    start_date: string; end_date: string; status: 'upcoming' | 'active' | 'ended'; participants: number; joined: boolean; progress: number | null
  }[]
}

export const METRIC_UNIT = { sessions: '회', minutes: '분', active_days: '일' } as const
export const METRIC_LABEL = { sessions: '운동 횟수', minutes: '인정 운동 시간', active_days: '운동한 날' } as const

/** 본인 확인된 직원이면 내 현황을 불러옵니다. 아니면 data = null, needLogin = true */
export function useEngagement(refreshKey = 0) {
  const { me, mustChangePin, loaded } = useMe()
  const [data, setData] = useState<Engagement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const ready = loaded && !!me && !mustChangePin

  const reload = useCallback(async () => {
    if (!ready) { setData(null); setLoading(false); return }
    setLoading(true)
    const r = await api<Engagement>('/api/me/engagement')
    if (r.ok) { setData(r.data); setError('') } else setError(r.message || '불러오지 못했어요.')
    setLoading(false)
  }, [ready])

  useEffect(() => { reload() }, [reload, refreshKey])

  return { data, loading: !loaded || loading, error, reload, needLogin: loaded && !ready }
}

export function koreanDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`)
  const w = ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()]
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${w}요일`
}
