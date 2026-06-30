'use client'

import { useState } from 'react'

// 운동 종목에 자주 쓰는 이모지 모음
const EMOJIS = [
  '🏃', '🏃‍♀️', '🚶', '🧘', '🧘‍♀️', '🏋️', '🏋️‍♀️', '🤸',
  '🚴', '🚴‍♀️', '🏊', '🏊‍♀️', '⛹️', '🤾', '🤺', '🥊',
  '🥋', '🤽', '🏌️', '⛳', '🏓', '🏸', '🎾', '🏀',
  '⚽', '🏈', '⚾', '🏐', '🏉', '🎳', '⛷️', '🏂',
  '🤼', '🧗', '🚣', '🛹', '🤹', '🪂', '🥇', '💪',
  '🔥', '⚡', '❤️', '🫀',
]

export default function EmojiPicker({
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
        className="input-field flex w-16 items-center justify-center text-xl"
      >
        {value || '🏃'}
      </button>

      {open && (
        <>
          {/* 바깥 클릭 시 닫기 */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 grid w-64 grid-cols-8 gap-1 rounded-xl bg-white p-2 shadow-raised">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onChange(e)
                  setOpen(false)
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-lg transition hover:bg-brand-50 ${
                  value === e ? 'bg-brand-100' : ''
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
