'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ExerciseLog, ExerciseType } from '@/types/database'
import { colorForId } from '@/lib/colors'

interface FeedTabProps {
  isAdmin?: boolean
}

export default function FeedTab({ isAdmin = false }: FeedTabProps) {
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingLog, setEditingLog] = useState<ExerciseLog | null>(null)
  const [editForm, setEditForm] = useState<{ exercise_type_id: string; log_date: string; memo: string }>({
    exercise_type_id: '',
    log_date: '',
    memo: '',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [logRes, typeRes] = await Promise.all([
      supabase
        .from('exercise_logs')
        .select('*, employee:employees(*), exercise_type:exercise_types(*)')
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('exercise_types').select('*').order('name'),
    ])
    setLogs((logRes.data as ExerciseLog[]) ?? [])
    setExerciseTypes(typeRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(id: string) {
    if (!confirm('이 운동 기록을 삭제할까요?')) return
    const { error } = await supabase.from('exercise_logs').delete().eq('id', id)
    if (error) {
      alert('삭제 중 오류가 발생했습니다.')
    } else {
      load()
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
      load()
    }
  }

  if (loading) return <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />

  if (logs.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-10">아직 기록이 없어요.</p>
  }

  return (
    <>
      <ul className="space-y-3">
        {logs.map((log) => (
          <li key={log.id} className="border rounded-xl p-3 flex gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
              style={{ backgroundColor: colorForId(log.employee_id) }}
            >
              {log.employee?.name?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{log.employee?.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{log.log_date}</span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">
                {log.exercise_type?.icon} {log.exercise_type?.name}
              </p>
              {log.memo && <p className="text-xs text-gray-400 mt-1">"{log.memo}"</p>}
              {isAdmin && (
                <div className="flex gap-2 mt-2">
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
              )}
            </div>
          </li>
        ))}
      </ul>

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
    </>
  )
}
