'use client'

// 정원 그림판 — 80×80칸 바탕에 나무(가운데 고정)와 장식을 좌표대로 그립니다. 내 정원(옮기기 가능)과 동료 정원(구경만)이 같이 씁니다.
//  · scale = 픽셀 1칸을 화면 몇 px 로 그릴지(정수: 4 또는 3) → 도트가 뭉개지지 않음
//  · 좌표 (x, y) = 장식의 발끝(아래쪽 가운데). y 가 큰 것이 앞에 그려짐
//  · onMove 를 주면 편집 가능: 장식을 끌어서 옮기거나, 장식을 고른 뒤 빈 자리를 누르면 그 자리로 옮김. 저장은 손을 뗄 때 1번.
//  · 움직이는 효과 없음(11-18 TK: 흔들리면 멀미 남)
import { useRef, useState } from 'react'
import { clampSpot, decorByKey, GARDEN_SIZE, GARDEN_TREE, Placed, TREE_STAGES } from '@/lib/game'

interface Props {
  stage: number
  items: Placed[]
  scale: number
  label: string
  selected?: string | null
  disabled?: boolean
  onSelect?: (key: string | null) => void
  onMove?: (key: string, x: number, y: number) => void
}

export default function GardenCanvas({ stage, items, scale, label, selected = null, disabled = false, onSelect, onMove }: Props) {
  const box = useRef<HTMLDivElement>(null)
  // 끄는 중인 장식: 화면에만 반영하고, 손을 떼면 onMove 로 한 번 저장
  const [drag, setDrag] = useState<{ key: string; x: number; y: number; ox: number; oy: number; dx: number; dy: number } | null>(null)
  const editable = !!onMove && !disabled
  const px = GARDEN_SIZE * scale
  const n = Math.min(Math.max(Math.round(stage) || 1, 1), TREE_STAGES.length)

  const cellAt = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }

  const shown = items.map((it) => (drag && drag.key === it.key ? { ...it, x: drag.x, y: drag.y } : it))

  return (
    <div ref={box} role={editable ? 'group' : 'img'} aria-label={label}
      className="relative mx-auto overflow-hidden rounded-2xl bg-brand-50" style={{ width: px, height: px }}
      onClick={(e) => {
        // 장식을 고른 상태에서 빈 자리를 누르면 그 자리로(그림 가운데가 누른 곳에 오게)
        if (!editable || !selected || e.target !== e.currentTarget) return
        const d = decorByKey(selected); if (!d) return
        const c = cellAt(e)
        const p = clampSpot(d, c.x, c.y + d.h / 2)
        onMove!(selected, p.x, p.y)
      }}>
      {/* 나무: 가운데 고정, 누를 수 없음 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/game/v22/tree/stage-${n}.png`} alt="" draggable={false}
        className="pointer-events-none absolute select-none"
        style={{
          imageRendering: 'pixelated', width: GARDEN_TREE.w * scale, height: GARDEN_TREE.h * scale,
          left: (GARDEN_TREE.x - GARDEN_TREE.w / 2) * scale, top: (GARDEN_TREE.y - GARDEN_TREE.h) * scale, zIndex: GARDEN_TREE.y,
        }} />
      {shown.map((it) => {
        const d = decorByKey(it.key)
        if (!d) return null
        const on = selected === it.key
        const style = {
          width: d.w * scale, height: d.h * scale, left: (it.x - d.w / 2) * scale, top: (it.y - d.h) * scale,
          zIndex: it.y + (on ? 200 : 0), touchAction: editable ? 'none' as const : undefined,
        }
        const img = (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.src} alt={editable ? '' : d.name} draggable={false} className="pointer-events-none block h-full w-full select-none" style={{ imageRendering: 'pixelated' }} />
        )
        if (!editable) return <div key={it.key} className="absolute" style={style}>{img}</div>
        return (
          <button key={it.key} type="button" aria-label={`${d.name}${on ? ' (고름)' : ''}. 끌어서 옮기기`} aria-pressed={on}
            className={`absolute rounded-md p-0 ${on ? 'outline-dashed outline-2 outline-offset-2 outline-ink-900' : ''}`} style={style}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              const c = cellAt(e)
              setDrag({ key: it.key, x: it.x, y: it.y, ox: it.x, oy: it.y, dx: c.x - it.x, dy: c.y - it.y })
            }}
            onPointerMove={(e) => {
              if (!drag || drag.key !== it.key) return
              const c = cellAt(e)
              const p = clampSpot(d, c.x - drag.dx, c.y - drag.dy)
              if (p.x === drag.x && p.y === drag.y) return
              setDrag({ ...drag, x: p.x, y: p.y })
            }}
            onPointerUp={() => {
              if (!drag || drag.key !== it.key) return
              const g = drag
              setDrag(null)
              // 처음 자리(ox, oy)와 다르면 옮긴 것, 같으면 누르기만 한 것(고르기·해제)
              if (g.x !== g.ox || g.y !== g.oy) { onSelect?.(it.key); onMove!(it.key, g.x, g.y) }
              else onSelect?.(on ? null : it.key)
            }}
            onPointerCancel={() => setDrag(null)}
            onClick={(e) => e.stopPropagation()}>
            {img}
          </button>
        )
      })}
    </div>
  )
}
