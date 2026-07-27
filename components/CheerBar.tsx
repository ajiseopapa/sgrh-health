'use client'

import { CHEER_EMOJIS, CHEER_LABEL, LogReaction } from '@/types/database'

interface Props {
  /** 이 기록에 달린 응원만 걸러서 넘겨주세요 */
  reactions: LogReaction[]
  /** 나(브라우저에 기억된 직원)의 id. 아직 이름을 안 골랐으면 undefined */
  myId?: string
  /** 내 기록이면 응원 버튼 대신 받은 응원만 보여줍니다 */
  isOwn: boolean
  onToggle: (emoji: string) => void
}

// "박OO님 외 2명이 응원했어요" 문구 만들기
function buildCheerText(reactions: LogReaction[]): string {
  const names: string[] = []
  for (const r of reactions) {
    const name = r.employee?.name
    if (name && !names.includes(name)) names.push(name)
  }
  if (names.length === 0) return ''
  if (names.length <= 2) return `${names.map((n) => `${n}님`).join(', ')}이 응원했어요`
  return `${names[0]}님 외 ${names.length - 1}명이 응원했어요`
}

export default function CheerBar({ reactions, myId, isOwn, onToggle }: Props) {
  const cheerText = buildCheerText(reactions)

  // 내 기록인데 아직 아무도 응원 안 했으면 빈 줄을 만들지 않고 그냥 숨깁니다.
  if (isOwn && reactions.length === 0) return null

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {CHEER_EMOJIS.map((emoji) => {
          const count = reactions.filter((r) => r.emoji === emoji).length
          const mine = myId ? reactions.some((r) => r.emoji === emoji && r.employee_id === myId) : false

          // 내 기록에서는 아무도 안 누른 이모지까지 늘어놓을 필요가 없습니다.
          if (isOwn && count === 0) return null

          return (
            <button
              key={emoji}
              type="button"
              disabled={isOwn}
              onClick={() => onToggle(emoji)}
              aria-label={`${CHEER_LABEL[emoji] ?? '응원'}${count > 0 ? ` ${count}명` : ''}`}
              aria-pressed={mine}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition active:scale-95 disabled:active:scale-100 ${
                mine
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

      {cheerText && <p className="mt-1.5 text-[11px] text-ink-400">{cheerText}</p>}
    </div>
  )
}
