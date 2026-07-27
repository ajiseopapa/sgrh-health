'use client'

import { CHEER_EMOJIS, CHEER_LABEL, LogReaction } from '@/types/database'

interface Props {
  /** 이 기록에 달린 응원만 걸러서 넘겨주세요 */
  reactions: LogReaction[]
  /** 내 기기 id. 내가 누른 이모지를 색으로 표시하는 데만 씁니다 */
  myDeviceId?: string
  onToggle: (emoji: string) => void
}

export default function CheerBar({ reactions, myDeviceId, onToggle }: Props) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {CHEER_EMOJIS.map((emoji) => {
        const mine = reactions.filter((r) => r.emoji === emoji)
        const count = mine.length
        const isMine = myDeviceId
          ? mine.some((r) => r.device_id === myDeviceId)
          : false
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
