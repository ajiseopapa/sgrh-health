// 캐릭터 그림 — 기본 캐릭터·의상·입은 아이템을 겹쳐 그립니다(lib/game.ts characterLayers).
// 모든 그림이 같은 캔버스(2:3)라 같은 크기로 겹치기만 하면 제자리에 맞습니다. 아이템이 없으면 한 장짜리 그림 그대로.
import { characterLayers, characterOf, Equipped } from '@/lib/game'

export default function CharacterFigure({ charKey, outfit, equipped, width, className = '', label }: {
  charKey: string | null | undefined
  outfit?: string | null
  equipped?: Equipped | null
  width: number
  className?: string
  /** 화면 읽기용 이름. 없으면 'OO형 캐릭터' */
  label?: string
}) {
  const layers = characterLayers(charKey, outfit, equipped)
  const height = Math.round((width * 3) / 2)
  return (
    <span role="img" aria-label={label ?? `${characterOf(charKey).name} 캐릭터`}
      className={`relative inline-block shrink-0 ${className}`} style={{ width, height }}>
      {layers.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src + i} src={src} alt="" draggable={false} width={width} height={height}
          className="pointer-events-none absolute inset-0 h-full w-full select-none" />
      ))}
    </span>
  )
}
