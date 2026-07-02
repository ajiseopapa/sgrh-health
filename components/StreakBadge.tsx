'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcStreak } from '@/lib/dateUtils'

interface Props {
  employeeId: string
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
