'use client'

import { CHEER_EMOJIS, CHEER_LABEL } from '@/types/database'

export interface CheerState {
  count: number
  mine: boolean // 이 기기에서 누른 응원인지
}

interface Props {
  /** 이 기록의 이모지별 응원 상태 (없으면 0개·안 누름) */
  cheers: Partial<Record<string, CheerState>>
  onToggle: (emoji: string) => void
}

export default function CheerBar({ cheers, onToggle }: Props) {
  return (
    <div className="-ml-1 mt-2.5 flex flex-wrap items-center gap-1">
      {CHEER_EMOJIS.map((emoji) => {
        const count = cheers[emoji]?.count ?? 0
        const isMine = cheers[emoji]?.mine ?? false
        const label = CHEER_LABEL[emoji] ?? '응원'

        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            aria-label={`${label}${count > 0 ? ` ${count}개` : ''}`}
            aria-pressed={isMine}
            className={`flex min-h-[44px] min-w-[56px] items-center justify-center gap-1 rounded-full border px-3 text-[14px] font-bold tabular-nums transition ${
              isMine
                ? 'border-brand-600 bg-brand-50 text-brand-800'
                : 'border-ink-200 text-ink-600'
            }`}
          >
            <span className="text-[16px] leading-none">{emoji}</span>
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
