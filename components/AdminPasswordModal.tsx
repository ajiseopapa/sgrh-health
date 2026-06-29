'use client'

import { useState } from 'react'

export default function AdminPasswordModal({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void
  onCancel: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!password) {
      setError('비밀번호를 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.ok) {
        sessionStorage.setItem('admin_unlocked', 'true')
        onSuccess()
      } else {
        setError(data.message || '비밀번호가 올바르지 않아요.')
      }
    } catch {
      setError('확인 중 오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center px-6">
      <div className="w-full max-w-xs bg-white rounded-xl p-5 space-y-3">
        <h3 className="text-base font-bold">🔒 관리자 비밀번호</h3>
        <p className="text-xs text-gray-400">설정에 들어가려면 비밀번호가 필요해요.</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="비밀번호"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 border rounded-lg py-2 text-sm text-gray-500"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? '확인 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}
