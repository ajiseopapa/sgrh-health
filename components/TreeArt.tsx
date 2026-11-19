import { TREE_STAGES } from '@/lib/game'

/**
 * 나무 그림 4단계(public/game/v22/tree/stage-N.png, 정사각 320px 투명 PNG) — 디자이너 시트에서 잘라 넣은 그림.
 * 도트 격자가 아닌 큰 그림이라 부드럽게 줄여 그립니다.
 */
export default function TreeArt({ stage, size = 96 }: { stage: number; size?: number }) {
  const n = Math.min(Math.max(Math.round(stage) || 1, 1), TREE_STAGES.length)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/game/v22/tree/stage-${n}.png`} alt={`${TREE_STAGES[n - 1].name} 그림`} width={size} height={size}
      className="shrink-0"  // 움직이지 않음(11-18 TK: 흔들리면 멀미 남)
      style={{ width: size, height: size }} />
  )
}
