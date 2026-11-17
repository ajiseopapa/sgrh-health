import { TREE_STAGES } from '@/lib/game'

/**
 * 나무 그림 — 픽셀 아트 4단계(public/game/v22/tree/stage-N.png, 24×24 격자를 4배로 그린 96px).
 * 지금 파일은 개발자 임시 시안(scripts/make-tree-art.py). 디자이너 그림이 오면 같은 파일명으로 바꾸면 됩니다.
 * size 는 24의 배수(48·72·96)로 주면 픽셀이 뭉개지지 않습니다.
 */
export default function TreeArt({ stage, size = 96 }: { stage: number; size?: number }) {
  const n = Math.min(Math.max(Math.round(stage) || 1, 1), TREE_STAGES.length)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/game/v22/tree/stage-${n}.png`} alt={`${TREE_STAGES[n - 1].name} 그림`} width={size} height={size}
      className="shrink-0 motion-safe:animate-[sway_4s_ease-in-out_infinite] origin-bottom"
      style={{ imageRendering: 'pixelated', width: size, height: size }} />
  )
}
