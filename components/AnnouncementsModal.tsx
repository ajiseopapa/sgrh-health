'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Announcement } from '@/types/database'

interface Props {
  isOpen: boolean
  onClose: () => void
  isAdmin: boolean
}

const LS_KEY = 'announcements_read_at'

export default function AnnouncementsModal({ isOpen, onClose, isAdmin }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', content: '' })
  const [saving, setSaving] = useState(false)

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    setAnnouncements(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    fetchAnnouncements()
    // 열릴 때 읽음 처리 (빨간 점 제거용)
    localStorage.setItem(LS_KEY, new Date().toISOString())
  }, [isOpen, fetchAnnouncements])

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    if (editingId) {
      await supabase
        .from('announcements')
        .update({ title: form.title, content: form.content })
        .eq('id', editingId)
    } else {
      await supabase.from('announcements').insert({
        title: form.title,
        content: form.content,
      })
    }
    setForm({ title: '', content: '' })
    setIsWriting(false)
    setEditingId(null)
    setSaving(false)
    fetchAnnouncements()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('이 공지를 삭제하시겠습니까?')) return
    await supabase.from('announcements').delete().eq('id', id)
    fetchAnnouncements()
  }

  function startEdit(a: Announcement) {
    setForm({ title: a.title, content: a.content })
    setEditingId(a.id)
    setIsWriting(true)
  }

  function cancelWrite() {
    setForm({ title: '', content: '' })
    setEditingId(null)
    setIsWriting(false)
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl w-full max-w-md flex flex-col"
        style={{ maxHeight: '82vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h2 className="font-bold text-[15px] text-gray-900">📢 업데이트 내역</h2>
          <div className="flex items-center gap-2">
            {isAdmin && !isWriting && (
              <button
                onClick={() => setIsWriting(true)}
                className="text-xs bg-teal-500 text-white px-3 py-1 rounded-full font-medium"
              >
                + 작성
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

        {/* ── 작성/수정 폼 (관리자) ── */}
        {isAdmin && isWriting && (
          <div className="px-4 py-3 bg-gray-50 border-b space-y-2 shrink-0">
            <p className="text-xs font-semibold text-gray-500 mb-1">
              {editingId ? '공지 수정' : '새 공지 작성'}
            </p>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="제목을 입력하세요"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
              rows={4}
              placeholder="내용을 입력하세요"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelWrite}
                className="text-xs text-gray-500 px-3 py-1.5"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs bg-teal-500 text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
              >
                {saving ? '저장 중…' : editingId ? '수정 완료' : '등록'}
              </button>
            </div>
          </div>
        )}

        {/* ── 목록 ── */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-center text-gray-400 py-10 text-sm">불러오는 중…</p>
          ) : announcements.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm text-gray-400">등록된 업데이트가 없습니다</p>
            </div>
          ) : (
            <ul>
              {announcements.map((a, i) => (
                <li
                  key={a.id}
                  className={`px-4 py-4 ${i < announcements.length - 1 ? 'border-b' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 leading-snug">
                        {a.title}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed">
                        {a.content}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-2">{formatDate(a.created_at)}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                        <button
                          onClick={() => startEdit(a)}
                          className="text-[11px] text-teal-500 font-medium"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="text-[11px] text-red-400 font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// 새 공지가 있는지 확인하는 유틸 훅 (헤더 빨간 점용)
// app/page.tsx에서 import해서 사용
// ──────────────────────────────────────────────────────────────
export function useHasUnreadAnnouncements(): boolean {
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    async function check() {
      const readAt = localStorage.getItem(LS_KEY)
      const query = supabase
        .from('announcements')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)

      if (readAt) {
        query.gt('created_at', readAt)
      }

      const { data } = await query
      setHasUnread((data?.length ?? 0) > 0)
    }
    check()
  }, [])

  return hasUnread
}
