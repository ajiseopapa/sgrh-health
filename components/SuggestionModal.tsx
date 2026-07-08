'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Suggestion, Employee } from '@/types/database'

interface Props {
  isOpen: boolean
  onClose: () => void
  isAdmin: boolean
}

const STATUS_LABEL: Record<Suggestion['status'], string> = {
  new: '새 건의',
  read: '확인함',
  answered: '답변완료',
}

const STATUS_STYLE: Record<Suggestion['status'], string> = {
  new: 'bg-red-50 text-red-500',
  read: 'bg-ink-100 text-ink-500',
  answered: 'bg-brand-50 text-brand-700',
}

export default function SuggestionModal({ isOpen, onClose, isAdmin }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── 작성 폼 상태 ──
  const [employees, setEmployees] = useState<Employee[]>([])
  const [query, setQuery] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')

  // ── 답변 작성 상태 (관리자) ──
  const [replyDraft, setReplyDraft] = useState('')
  const [replySaving, setReplySaving] = useState(false)

  const filteredEmployees = useMemo(() => {
    if (!query) return []
    const q = query.trim().toLowerCase()
    return employees
      .filter((e) => e.name.toLowerCase().includes(q) || e.employee_number?.toLowerCase().includes(q))
      .slice(0, 5)
  }, [employees, query])

  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('suggestions')
      .select('*')
      .order('created_at', { ascending: false })
    setSuggestions((data as Suggestion[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    fetchSuggestions()
    supabase.from('employees').select('*').order('name').then(({ data }) => setEmployees(data ?? []))
  }, [isOpen, fetchSuggestions])

  function resetForm() {
    setQuery('')
    setSelectedEmployee(null)
    setIsAnonymous(false)
    setTitle('')
    setContent('')
    setSubmitMessage('')
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) return
    if (!isAnonymous && !selectedEmployee) {
      setSubmitMessage('이름을 선택하거나 익명으로 체크해주세요.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('suggestions').insert({
      employee_id: isAnonymous ? null : selectedEmployee?.id ?? null,
      employee_name: isAnonymous ? null : selectedEmployee?.name ?? null,
      title: title.trim(),
      content: content.trim(),
    })
    setSaving(false)
    if (error) {
      setSubmitMessage('전송에 실패했어요. 다시 시도해주세요.')
      return
    }
    resetForm()
    setIsWriting(false)
    fetchSuggestions()
  }

  async function toggleExpand(s: Suggestion) {
    const opening = expandedId !== s.id
    setExpandedId(opening ? s.id : null)
    setReplyDraft(s.admin_reply ?? '')
    // 관리자가 새 건의를 열어보면 자동으로 '확인함' 처리
    if (opening && isAdmin && s.status === 'new') {
      await supabase.from('suggestions').update({ status: 'read' }).eq('id', s.id)
      setSuggestions((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: 'read' } : x)))
    }
  }

  async function handleSaveReply(id: string) {
    setReplySaving(true)
    await supabase
      .from('suggestions')
      .update({
        admin_reply: replyDraft.trim() || null,
        status: replyDraft.trim() ? 'answered' : 'read',
        replied_at: replyDraft.trim() ? new Date().toISOString() : null,
      })
      .eq('id', id)
    setReplySaving(false)
    fetchSuggestions()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('이 건의를 삭제하시겠습니까?')) return
    await supabase.from('suggestions').delete().eq('id', id)
    if (expandedId === id) setExpandedId(null)
    fetchSuggestions()
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl w-full max-w-md flex flex-col"
        style={{ maxHeight: '86vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h2 className="font-bold text-[15px] text-gray-900">💬 건의함</h2>
          <div className="flex items-center gap-2">
            {!isWriting && (
              <button
                onClick={() => setIsWriting(true)}
                className="text-xs bg-teal-500 text-white px-3 py-1 rounded-full font-medium"
              >
                + 건의하기
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 text-2xl leading-none w-7 h-7 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── 작성 폼 (누구나) ── */}
        {isWriting && (
          <div className="px-4 py-3 bg-gray-50 border-b space-y-2 shrink-0">
            <p className="text-xs font-semibold text-gray-500 mb-1">새 건의 작성</p>

            {/* 이름 선택 / 익명 */}
            {!isAnonymous && (
              <div className="relative">
                {selectedEmployee ? (
                  <div className="flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <span className="font-medium text-gray-800">{selectedEmployee.name}</span>
                    <button
                      onClick={() => setSelectedEmployee(null)}
                      className="text-xs text-gray-400"
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      placeholder="이름 또는 사번 검색"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {filteredEmployees.length > 0 && (
                      <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl mt-1 shadow-lg overflow-hidden">
                        {filteredEmployees.map((e) => (
                          <li key={e.id}>
                            <button
                              onClick={() => {
                                setSelectedEmployee(e)
                                setQuery('')
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            >
                              {e.name}
                              {e.employee_number && (
                                <span className="text-gray-400 ml-1 text-xs">({e.employee_number})</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}

            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => {
                  setIsAnonymous(e.target.checked)
                  setSelectedEmployee(null)
                  setQuery('')
                }}
              />
              익명으로 건의하기
            </label>

            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
              rows={4}
              placeholder="건의/요청 내용을 입력하세요"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {submitMessage && <p className="text-xs text-red-500">{submitMessage}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  resetForm()
                  setIsWriting(false)
                }}
                className="text-xs text-gray-500 px-3 py-1.5"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="text-xs bg-teal-500 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
              >
                {saving ? '전송 중…' : '전송'}
              </button>
            </div>
          </div>
        )}

        {/* ── 목록 ── */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-center text-gray-400 py-10 text-sm">불러오는 중…</p>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm text-gray-400">등록된 건의가 없습니다</p>
            </div>
          ) : (
            <ul>
              {suggestions.map((s, i) => {
                const expanded = expandedId === s.id
                return (
                  <li
                    key={s.id}
                    className={`px-4 py-3 ${i < suggestions.length - 1 ? 'border-b' : ''}`}
                  >
                    <button className="w-full text-left" onClick={() => toggleExpand(s)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[s.status]}`}
                            >
                              {STATUS_LABEL[s.status]}
                            </span>
                            <p className="font-semibold text-sm text-gray-900 leading-snug truncate">
                              {s.title}
                            </p>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1">
                            {s.employee_name ?? '익명'} · {formatDate(s.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>

                    {expanded && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl px-3 py-2">
                          {s.content}
                        </p>

                        {s.admin_reply && (
                          <div className="rounded-xl px-3 py-2 bg-brand-50">
                            <p className="text-[11px] font-semibold text-brand-700 mb-1">관리자 답변</p>
                            <p className="text-xs text-brand-700 whitespace-pre-wrap leading-relaxed">
                              {s.admin_reply}
                            </p>
                          </div>
                        )}

                        {isAdmin && (
                          <div className="space-y-1.5">
                            <textarea
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
                              rows={2}
                              placeholder="답변을 입력하세요"
                              value={replyDraft}
                              onChange={(e) => setReplyDraft(e.target.value)}
                            />
                            <div className="flex justify-end gap-3">
                              <button
                                onClick={() => handleDelete(s.id)}
                                className="text-[11px] text-red-400 font-medium"
                              >
                                삭제
                              </button>
                              <button
                                onClick={() => handleSaveReply(s.id)}
                                disabled={replySaving}
                                className="text-[11px] bg-teal-500 text-white px-3 py-1 rounded-full font-medium disabled:opacity-50"
                              >
                                {replySaving ? '저장 중…' : '답변 저장'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// 관리자용: 새 건의(미확인)가 있는지 확인하는 훅 (헤더 빨간 점용)
// ──────────────────────────────────────────────────────────────
export function useHasNewSuggestions(isAdmin: boolean): boolean {
  const [hasNew, setHasNew] = useState(false)

  useEffect(() => {
    if (!isAdmin) {
      setHasNew(false)
      return
    }
    let cancelled = false
    async function check() {
      const { data } = await supabase.from('suggestions').select('id').eq('status', 'new').limit(1)
      if (!cancelled) setHasNew((data?.length ?? 0) > 0)
    }
    check()
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  return hasNew
}
