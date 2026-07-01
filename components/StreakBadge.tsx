'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  employeeId: string
}

/** exercise_logs의 logged_date 배열로 연속 일수 계산 */
function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0

  // 중복 제거 후 최신순 정렬
  const unique = [...new Set(dates)].sort((a, b) => (a > b ? -1 : 1))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = 0
  let expected = new Date(today)

  for (const d of unique) {
    const date = new Date(d)
    date.setHours(0, 0, 0, 0)
    const diff = Math.round(
      (expected.getTime() - date.getTime()) / 86_400_000
    )
    if (diff === 0) {
      streak++
      expected.setDate(expected.getDate() - 1)
    } else if (diff === 1 && streak === 0) {
      // 오늘 기록이 없어도 어제부터 연속이면 유지 (strict 원하면 이 분기 제거)
      streak++
      expected = new Date(date)
      expected.setDate(expected.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

function badgeInfo(streak: number) {
  if (streak >= 30) return { icon: '🏆', label: `${streak}일 연속! 한 달 달성`, color: 'bg-yellow-50 border-yellow-300 text-yellow-700' }
  if (streak >= 7)  return { icon: '🥇', label: `${streak}일 연속! 주간 달성`, color: 'bg-orange-50 border-orange-200 text-orange-600' }
  return              { icon: '🔥', label: `${streak}일 연속`, color: 'bg-red-50 border-red-200 text-red-500' }
}

export default function StreakBadge({ employeeId }: Props) {
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    async function load() {
      // 최근 60일치만 가져오면 충분
      const since = new Date()
      since.setDate(since.getDate() - 60)
      const { data } = await supabase
        .from('exercise_logs')
        .select('log_date')
        .eq('employee_id', employeeId)
        .gte('log_date', since.toISOString().slice(0, 10))
        .order('log_date', { ascending: false })

      if (data) setStreak(calcStreak(data.map(r => r.log_date as string)))
    }
    load()
  }, [employeeId])

  if (streak < 2) return null   // 1일이면 표시 안 함

  const { icon, label, color } = badgeInfo(streak)

  return (
    <div className={`flex items-center gap-1.5 border rounded-full px-3 py-1 w-fit mx-3 mb-2 ${color}`}>
      <span className="text-base leading-none">{icon}</span>
      <span className="text-xs font-semibold">{label}</span>
    </div>
  )
}
