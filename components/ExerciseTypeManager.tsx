'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ExerciseType } from '@/types/database'

const EXERCISE_EMOJIS = [
  '🏋️', '🤸', '🧘', '🏃', '🚴', '🏊', '🤽', '🚣', '🏄', '🤿',
  '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
  '🏓', '🏸', '🥊', '🥋', '🤼', '🤺', '🏇', '🧗', '🤾', '🏌️',
  '🏹', '🎿', '🛹', '🛼', '🏂', '🪂', '🤼‍♂️', '💪', '🦵', '🧠',
  '🫀', '🏆', '🥇', '🎯', '🔥', '💦', '👟', '⏱️', '🩺', '🧴',
]

function EmojiPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (emoji: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-10 text-xl border rounded-lg flex items-center justify-center hover:bg-gray-50 active:bg-gray-100"
      >
        {value || '➕'}
      </button>
      {open && (
        <>
          {/* 외부 클릭 시 닫기 */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-12 left-0 bg-white border rounded-xl shadow-xl p-3 w-64">
            <p className="text-xs text-gray-400 mb-2">운동 이모지 선택</p>
            <div className="grid grid-cols-8 gap-1">
              {EXERCISE_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onChange(emoji)
                    setOpen(false)
                  }}
                  className={`w-8 h-8 text-lg rounded-lg flex items-center justify-center hover:bg-gray-100 ${
                    value === emoji ? 'bg-blue-100 ring-1 ring-blue-400' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function ExerciseTypeManager() {
  const [list, setList] = useState<ExerciseType[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🏋️')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')

  async function fetchList() {
    setLoading(true)
    const { data } = await supabase.from('exercise_types').select('*').order('name')
    setList(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchList()
  }, [])

  async function handleAdd() {
    if (!name.trim()) {
      setError('운동 이름을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError('')
    const { error } = await supabase
      .from('exercise_types')
      .insert({ name: name.trim(), icon: icon || '🏋️' })
    setSubmitting(false)
    if (error) {
      setError(`등록에 실패했어요: ${error.message}`)
      return
    }
    setName('')
    setIcon('🏋️')
    fetchList()
  }

  function startEdit(t: ExerciseType) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditIcon(t.icon)
    setError('')
  }

  async function handleUpdate() {
    if (!editingId) return
    if (!editName.trim()) {
      setError('운동 이름을 입력해주세요.')
      return
    }
    const { error } = await supabase
      .from('exercise_types')
      .update({ name: editName.trim(), icon: editIcon || '🏋️' })
      .eq('id', editingId)
    if (error) {
      setError(`수정에 실패했어요: ${error.message}`)
      return
    }
    setEditingId(null)
    setError('')
    fetchList()
  }

  async function handleDelete(id: string, typeName: string) {
    const ok = window.confirm(`'${typeName}' 종목을 삭제할까요?`)
    if (!ok) return
    const { error } = await supabase.from('exercise_types').delete().eq('id', id)
    if (error) {
      if (error.code === '23503') {
        setError(`'${typeName}'으로 기록된 운동 일지가 있어서 삭제할 수 없어요.`)
      } else {
        setError('삭제에 실패했어요.')
      }
      return
    }
    fetchList()
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-3 space-y-2">
        <p className="text-sm font-semibold text-gray-600">운동 종목 등록</p>
        <div className="flex gap-2 items-center">
          <EmojiPicker value={icon} onChange={setIcon} />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="운동 이름"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={submitting}
          className="w-full bg-brand-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? '등록 중...' : '등록'}
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-600 mb-2">운동 종목 목록 ({list.length}개)</p>
        {loading ? (
          <div className="h-20 rounded-xl bg-gray-100 animate-pulse" />
        ) : list.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6 border rounded-xl">
            등록된 운동 종목이 없어요.
          </p>
        ) : (
          <ul className="divide-y border rounded-xl">
            {list.map((t) => (
              <li key={t.id} className="px-3 py-2">
                {editingId === t.id ? (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <EmojiPicker value={editIcon} onChange={setEditIcon} />
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 border rounded-lg px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdate}
                        className="flex-1 bg-brand-600 text-white rounded-lg py-1.5 text-xs font-medium"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 border rounded-lg py-1.5 text-xs"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {t.icon} {t.name}
                    </span>
                    <div className="flex gap-3 text-xs shrink-0">
                      <button onClick={() => startEdit(t)} className="text-brand-600 font-medium">
                        수정
                      </button>
                      <button onClick={() => handleDelete(t.id, t.name)} className="text-red-500 font-medium">
                        삭제
                      </button>
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
