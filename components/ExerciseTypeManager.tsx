'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ExerciseType } from '@/types/database'
import EmojiPicker from './EmojiPicker'

export default function ExerciseTypeManager() {
  const [list, setList] = useState<ExerciseType[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🏃')
  const [trackDistance, setTrackDistance] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editTrackDistance, setEditTrackDistance] = useState(false)

  async function fetchList() {
    setLoading(true)
    const { data } = await supabase.from('exercise_types').select('*').order('name')
    setList(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchList() }, [])

  async function handleAdd() {
    if (!name.trim()) { setError('운동 이름을 입력해주세요.'); return }
    setSubmitting(true); setError('')
    const { error } = await supabase.from('exercise_types').insert({
      name: name.trim(),
      icon: icon.trim() || '🏃',
      track_distance: trackDistance,
    })
    setSubmitting(false)
    if (error) { setError(`등록에 실패했어요: ${error.message}`); return }
    setName(''); setIcon('🏃'); setTrackDistance(false)
    fetchList()
  }

  function startEdit(t: ExerciseType) {
    setEditingId(t.id); setEditName(t.name)
    setEditIcon(t.icon); setEditTrackDistance(t.track_distance)
    setError('')
  }

  async function handleUpdate() {
    if (!editingId) return
    if (!editName.trim()) { setError('운동 이름을 입력해주세요.'); return }
    const { error } = await supabase.from('exercise_types')
      .update({ name: editName.trim(), icon: editIcon.trim() || '🏃', track_distance: editTrackDistance })
      .eq('id', editingId)
    if (error) { setError(`수정에 실패했어요: ${error.message}`); return }
    setEditingId(null); setError(''); fetchList()
  }

  async function handleDelete(id: string, typeName: string) {
    if (!window.confirm(`'${typeName}' 종목을 삭제할까요?`)) return
    const { error } = await supabase.from('exercise_types').delete().eq('id', id)
    if (error) {
      setError(error.code === '23503'
        ? `'${typeName}'으로 기록된 운동 일지가 있어서 삭제할 수 없어요.`
        : `삭제에 실패했어요: ${error.message}`)
      return
    }
    fetchList()
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-2.5">
        <p className="text-sm font-semibold text-ink-700">운동 종목 등록</p>
        <div className="flex gap-2">
          <EmojiPicker value={icon} onChange={setIcon} />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="운동 이름"
            className="input-field flex-1"
          />
        </div>

        {/* 거리 추적 토글 */}
        <label className="flex cursor-pointer items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-ink-800">거리 추적</p>
            <p className="text-xs text-ink-400">기록 시 km·페이스 입력칸을 표시합니다</p>
          </div>
          <div
            onClick={() => setTrackDistance((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${trackDistance ? 'bg-brand-500' : 'bg-ink-200'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${trackDistance ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </div>
        </label>

        <p className="text-xs text-ink-300">왼쪽 아이콘을 눌러 운동에 어울리는 이모지를 골라보세요.</p>

        <button onClick={handleAdd} disabled={submitting} className="btn-primary">
          {submitting ? '등록 중...' : '등록'}
        </button>
        {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          운동 종목 목록 ({list.length}개)
        </p>
        {loading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-ink-100" />
        ) : list.length === 0 ? (
          <div className="card text-center text-sm text-ink-400">등록된 운동 종목이 없어요.</div>
        ) : (
          <ul className="card divide-y divide-ink-100 p-0">
            {list.map((t) => (
              <li key={t.id} className="px-4 py-3">
                {editingId === t.id ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <EmojiPicker value={editIcon} onChange={setEditIcon} />
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input-field flex-1 py-1.5"
                      />
                    </div>
                    <label className="flex cursor-pointer items-center justify-between rounded-xl bg-ink-50 px-3 py-2">
                      <p className="text-xs font-medium text-ink-700">거리 추적</p>
                      <div
                        onClick={() => setEditTrackDistance((v) => !v)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${editTrackDistance ? 'bg-brand-500' : 'bg-ink-200'}`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${editTrackDistance ? 'translate-x-4' : 'translate-x-0.5'}`}
                        />
                      </div>
                    </label>
                    <div className="flex gap-2 pt-0.5">
                      <button onClick={handleUpdate} className="btn-primary py-1.5 text-xs">저장</button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary py-1.5 text-xs">취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{t.icon}</span>
                      <div>
                        <span className="text-sm font-medium text-ink-800">{t.name}</span>
                        {t.track_distance && (
                          <span className="ml-1.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">
                            거리
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(t)} className="pill-action bg-brand-50 text-brand-700">수정</button>
                      <button onClick={() => handleDelete(t.id, t.name)} className="pill-action bg-red-50 text-red-500">삭제</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
