'use client'

// 도전 › 정원 — 나의 정원: 가운데 나무(운동으로만 자람) + 햇빛으로 받은 장식을 자유롭게 놓기
// 가격·잔액·가진 장식·좌표 확인은 모두 서버가 합니다. 이 화면은 보여 주고 요청만 보냅니다.
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useDialog } from '@/lib/dialog'
import { clampSpot, DECOR, Decor, decorByKey, GARDEN_SIZE, GARDEN_SPOTS, Placed, TREE_STAGES } from '@/lib/game'
import { Notice, Progress } from '@/lib/ui'
import GardenCanvas from './GardenCanvas'
import InfoTip from './InfoTip'

export interface GardenGame {
  sunlight: { balance: number }
  tree: { stage: number; name: string; activeDays: number; next: { name: string; at: number; remaining: number } | null }
  garden?: { ready: boolean; owned: string[]; items: Placed[] }
}

function hasBatchim(word: string) {
  const c = word.charCodeAt(word.length - 1)
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0
}
const obj = (d: Decor) => `${d.name}${hasBatchim(d.name) ? '을' : '를'}`

/** 새 장식을 놓을 기본 자리: 다른 장식과 겹치지 않는 첫 자리 */
function freeSpot(d: Decor, items: Placed[]) {
  const spot = GARDEN_SPOTS.find((s) => !items.some((it) => Math.abs(it.x - s.x) < 12 && Math.abs(it.y - s.y) < 12)) ?? GARDEN_SPOTS[0]
  return clampSpot(d, spot.x, spot.y)
}

export default function MyGarden<G extends GardenGame>({ game, onChange }: { game: G; onChange: (g: G) => void }) {
  const dialog = useDialog()
  const wrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(4)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [moving, setMoving] = useState<Placed | null>(null) // 저장 응답이 오기 전까지 새 자리를 먼저 보여 줌
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const t = game.tree
  const g = game.garden ?? { ready: false, owned: [], items: [] }
  const items = moving ? [...g.items.filter((it) => it.key !== moving.key), moving] : g.items

  // 픽셀이 뭉개지지 않게 1칸을 정수 px 로: 폭이 320px 이상이면 4배, 좁으면 3배
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const fit = () => setScale(el.clientWidth >= GARDEN_SIZE * 4 ? 4 : 3)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  async function put(key: string, x: number, y: number, done?: string) {
    if (busy) return
    setBusy(true); setMsg(null); setMoving({ key, x, y })
    const r = await api<{ game: G }>('/api/me/game/garden', { method: 'PUT', body: { item: key, x, y } })
    setBusy(false); setMoving(null)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '옮기지 못했어요.' }); return false }
    onChange(r.data.game)
    if (done) setMsg({ tone: 'success', text: done })
    return true
  }

  async function takeOut(d: Decor) {
    if (busy) return
    setBusy(true); setMsg(null)
    const r = await api<{ game: G }>('/api/me/game/garden', { method: 'PUT', body: { item: d.key, remove: true } })
    setBusy(false)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '처리하지 못했어요.' }); return }
    onChange(r.data.game); setSelected(null)
    setMsg({ tone: 'success', text: `${obj(d)} 빼 두었어요.` })
  }

  async function lay(d: Decor) {
    const s = freeSpot(d, g.items)
    if (await put(d.key, s.x, s.y, `${obj(d)} 놓았어요. 끌어서 자리를 옮겨 보세요.`)) setSelected(d.key)
  }

  async function buy(d: Decor) {
    if (busy) return
    const yes = await dialog.confirm({
      title: `${obj(d)} 받을까요?`,
      message: `햇빛 ${d.price}개를 써요. 받은 장식은 내 것이 되고, 햇빛으로 되돌릴 수 없어요.`,
      confirmText: '받기',
    })
    if (!yes) return
    setBusy(true); setMsg(null)
    const b = await api<{ game: G }>('/api/me/game/purchase', { method: 'POST', body: { item: d.key } })
    setBusy(false)
    if (!b.ok) { setMsg({ tone: 'error', text: b.message || '받지 못했어요.' }); return }
    onChange(b.data.game)
    const s = freeSpot(d, b.data.game.garden?.items ?? [])
    if (await put(d.key, s.x, s.y, `${obj(d)} 받아서 정원에 놓았어요. 끌어서 자리를 옮겨 보세요.`)) setSelected(d.key)
    else setMsg({ tone: 'error', text: `${obj(d)} 받았지만 놓지는 못했어요. 아래 목록에서 다시 놓아 주세요.` })
  }

  const sel = decorByKey(selected)
  return (
    <section className="py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[14px] font-bold text-ink-700">나의 정원</p>
          <p className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-ink-900">{t.name}</p>
        </div>
        <p className="pb-1 text-right text-[13px] leading-relaxed text-ink-500">
          운동한 날 <span className="font-bold tabular-nums text-ink-900">{t.activeDays}일</span><br />
          놓은 장식 <span className="font-bold tabular-nums text-ink-900">{g.items.length}</span>개
        </p>
      </div>

      <div ref={wrap} className="mt-4">
        <GardenCanvas stage={t.stage} items={items} scale={scale} label="나의 정원. 장식을 끌어서 옮길 수 있어요."
          selected={selected} disabled={!g.ready} onSelect={setSelected}
          onMove={(key, x, y) => { void put(key, x, y) }} />
      </div>

      {/* 고른 장식 안내 */}
      <div className="mt-3 flex min-h-[44px] items-center justify-between gap-3 text-[13px]">
        {sel ? (
          <>
            <p className="text-ink-700"><span className="font-bold text-ink-900">{sel.name}</span> 고름 · 끌거나, 놓을 자리를 눌러 옮겨요.</p>
            <button type="button" disabled={busy} onClick={() => takeOut(sel)} className="pill-action shrink-0 text-ink-900 underline">빼 두기</button>
          </>
        ) : (
          <p className="text-ink-500">{g.items.length ? '장식을 끌어서 원하는 자리로 옮겨 보세요.' : '아래에서 장식을 받아 정원에 놓아 보세요.'}</p>
        )}
      </div>

      <div className="mt-2">
        {t.next ? (
          <>
            <Progress value={t.activeDays - TREE_STAGES[t.stage - 1].from} max={t.next.at - TREE_STAGES[t.stage - 1].from} label={`${t.next.name}까지 진행률`} />
            <p className="mt-2 text-[13px] text-ink-500">{t.next.remaining}일 더 운동하면 {t.next.name}로 자라요. 쉬어도 작아지지 않아요.</p>
          </>
        ) : (
          <p className="text-[13px] text-ink-500">가장 큰 나무까지 자랐어요.</p>
        )}
      </div>
      {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}

      {/* 장식 목록: 받기 · 놓기 · 고르기 */}
      <div className="mt-6 flex items-baseline justify-between">
        <p className="text-[15px] font-bold text-ink-900">장식</p>
        <p className="text-[13px] text-ink-500">보유 햇빛 <span className="font-bold tabular-nums text-ink-900">{game.sunlight.balance}개</span></p>
      </div>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {DECOR.map((d) => {
          const owned = g.owned.includes(d.key)
          const placed = g.items.some((it) => it.key === d.key)
          const short = !owned && game.sunlight.balance < d.price
          const on = selected === d.key
          return (
            <li key={d.key} className="flex min-h-[64px] items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.src} alt="" width={d.w * 2} height={d.h * 2} className="max-h-12 max-w-12 object-contain" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold text-ink-900">{d.name}</span>
                  <span className="block text-[12px] text-ink-500">{placed ? '정원에 있어요' : owned ? '가지고 있어요' : `햇빛 ${d.price}개`}</span>
                </span>
              </span>
              {placed ? (
                <button type="button" disabled={busy || !g.ready} onClick={() => setSelected(on ? null : d.key)} aria-pressed={on}
                  className={`shrink-0 rounded-lg border px-4 py-2 text-[14px] font-bold disabled:opacity-50 ${on ? 'border-ink-900 bg-brand-300 text-ink-900' : 'border-ink-300 text-ink-700'}`}>
                  {on ? '고름' : '고르기'}
                </button>
              ) : owned ? (
                <button type="button" disabled={busy || !g.ready} onClick={() => lay(d)}
                  className="shrink-0 rounded-lg border border-ink-900 px-4 py-2 text-[14px] font-bold text-ink-900 active:bg-ink-50 disabled:opacity-50">놓기</button>
              ) : (
                <button type="button" disabled={busy || short || !g.ready} onClick={() => buy(d)}
                  className="shrink-0 rounded-lg bg-ink-900 px-4 py-2 text-[14px] font-bold text-paper active:bg-ink-700 disabled:bg-ink-300">
                  {short ? '햇빛 모자람' : '받기'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <InfoTip label="정원 꾸미는 법" className="mt-2">
        <ul className="space-y-1">
          <li>나무는 운동한 날이 쌓이면 자라요. 햇빛으로는 자라지 않아요.</li>
          <li>햇빛으로 장식을 받으면 정원에 놓여요. 받은 장식은 계속 내 것이에요.</li>
          <li>장식을 끌어서 옮기거나, 장식을 고른 뒤 놓을 자리를 누르면 옮겨져요.</li>
          <li>고른 장식은 &lsquo;빼 두기&rsquo;로 정원에서 뺄 수 있어요. 다시 놓을 수 있어요.</li>
          {!g.ready && <li>정원 꾸미기는 곧 열려요.</li>}
        </ul>
      </InfoTip>
    </section>
  )
}
