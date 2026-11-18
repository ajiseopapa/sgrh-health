'use client'

import { useMemo, useState } from 'react'
import type { Employee } from '@/types/database'
import type { Me } from '@/lib/me'

interface Props {
  employees: Employee[]
  /** 이미 고른 이름이 있으면 "변경" 맥락으로 보여줍니다 */
  current: Me | null
  onSelect: (employee: Employee) => void
  onClose: () => void
}

export default function MePickerModal({ employees, current, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return employees.slice(0, 8)
    return employees
      .filter((e) => e.name.toLowerCase().includes(q) || e.employee_number?.toLowerCase().includes(q))
      .slice(0, 8)
  }, [employees, query])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-4 shadow-raised"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-900">
            {current ? '누구로 응원할까요?' : '응원하려면 이름을 알려주세요'}
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition active:bg-ink-100"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-ink-400">
          한 번만 고르면 이 기기에 기억돼요. 나중에 피드 위에서 바꿀 수 있어요.
        </p>

        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 또는 사번 검색"
          className="input-field"
        />

        <ul className="mt-2 max-h-64 space-y-1 overflow-auto">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onSelect(e)}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition active:bg-brand-50 ${
                  current?.id === e.id ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-800'
                }`}
              >
                {e.name}
                <span className="ml-1 text-xs text-ink-300">#{e.employee_number}</span>
                {current?.id === e.id && <span className="ml-1 text-xs">✓</span>}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-4 text-center text-xs text-ink-300">검색 결과가 없어요.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
