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
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
              isMine
                ? 'bg-brand-100 text-brand-700'
                : count > 0
                  ? 'bg-ink-50 text-ink-600'
                  : 'bg-ink-50 text-ink-300'
            }`}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
