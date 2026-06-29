'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee, ExerciseType, ExerciseLog } from '@/types/database'
import { getMonthRange, toDateKey } from '@/lib/dateUtils'
import TopRankingBoard from './TopRankingBoard'
import MiniCalendar from './MiniCalendar'
import ExerciseLogForm from './ExerciseLogForm'

interface HomeTabProps {
  isAdmin?: boolean
}

export default function HomeTab({ isAdmin = false }: HomeTabProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([])
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [loading, setLoading] = useState(true)
  const [editingLog, setEditingLog] = useState<ExerciseLog | null>(null)
  const [editForm, setEditForm] = useState<{ exercise_type_id: string; log_date: string; memo: string }>({
    exercise_type_id: '',
    log_date: '',
    memo: '',
  })
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { start, end } = getMonthRange()

    const [empRes, typeRes, logRes] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('exercise_types').select('*').order('name'),
      supabase
        .from('exercise_logs')
        .select('*, employee:employees(*), exercise_type:exercise_types(*)')
        .gte('log_date', toDateKey(start))
        .lte('log_date', toDateKey(end))
        .order('log_date', { ascending: false }),
    ])

    if (empRes.data) setEmployees(empRes.data)
    if (typeRes.data) setExerciseTypes(typeRes.data)
    if (logRes.data) setLogs(logRes.data as ExerciseLog[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function handleDelete(id: string) {
    if (!confirm('이 운동 기록을 삭제할까요?')) return
    const { error } = await supabase.from('exercise_logs').delete().eq('id', id)
    if (error) {
      alert('삭제 중 오류가 발생했습니다.')
    } else {
      fetchAll()
    }
  }

  function openEdit(log: ExerciseLog) {
    setEditingLog(log)
    setEditForm({
      exercise_type_id: log.exercise_type_id,
      log_date: log.log_date,
      memo: log.memo ?? '',
    })
  }

  async function handleSaveEdit() {
    if (!editingLog) return
    setSaving(true)
    const { error } = await supabase
      .from('exercise_logs')
      .update({
        exercise_type_id: editForm.exercise_type_id,
        log_date: editForm.log_date,
        memo: editForm.memo || null,
      })
      .eq('id', editingLog.id)
    setSaving(false)
    if (error) {
      alert('수정 중 오류가 발생했습니다.')
    } else {
      setEditingLog(null)
      fetchAll()
    }
  }

  return (
    <div className="space-y-6">
      <TopRankingBoard logs={logs} loading={loading} />
      <MiniCalendar logs={logs} />

      {/* 관리자 전용: 이번 달 기록 수정/삭제 */}
      {isAdmin && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500">📋 이번 달 기록 관리</h2>
          {loading ? (
            <p className="text-sm text-gray-400">불러오는 중...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-gray-400">기록이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {logs.map((log) => {
                const emp = log.employee as Employee | undefined
                const type = log.exercise_type as ExerciseType | undefined
                return (
                  <li
                    key={log.id}
                    className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{emp?.name ?? '?'}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span>{type?.icon ?? ''} {type?.name ?? '?'}</span>
                      <span className="text-gray-400 ml-1 text-xs">{log.log_date}</span>
                      {log.memo && <p className="text-xs text-gray-400 mt-0.5">{log.memo}</p>}
                    </div>
                    <div className="flex gap-2 ml-2 shrink-0">
                      <button
                        onClick={() => openEdit(log)}
                        className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <ExerciseLogForm employees={employees} exerciseTypes={exerciseTypes} onSuccess={fetchAll} />

      {/* 수정 모달 */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-bold text-base">기록 수정</h3>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">운동 종목</label>
              <select
                value={editForm.exercise_type_id}
                onChange={(e) => setEditForm({ ...editForm, exercise_type_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {exerciseTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">날짜</label>
              <input
                type="date"
                value={editForm.log_date}
                onChange={(e) => setEditForm({ ...editForm, log_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">메모 (선택)</label>
              <input
                type="text"
                value={editForm.memo}
                onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                placeholder="메모를 입력하세요"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditingLog(null)}
                className="flex-1 border rounded-xl py-2 text-sm text-gray-500"
              >
                취소
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 bg-blue-500 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
