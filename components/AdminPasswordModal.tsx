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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-xs space-y-4 rounded-3xl bg-white p-6 shadow-raised">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-xl">
            🔒
          </span>
          <div>
            <h3 className="text-base font-bold text-ink-900">관리자 확인</h3>
            <p className="text-xs text-ink-400">비밀번호를 입력해주세요.</p>
          </div>
        </div>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="비밀번호"
          className="input-field"
        />

        {error && <p className="text-xs font-medium text-red-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="btn-secondary">
            취소
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1">
            {submitting ? '확인 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}
