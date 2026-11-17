'use client'

// 도전 › 정원 — 나의 정원: 가운데 나무(운동으로만 자람) + 둘레 8칸 장식(햇빛으로 받음)
// 가격·잔액·가진 장식 확인은 모두 서버가 합니다. 이 화면은 보여 주고 요청만 보냅니다.
import { useState } from 'react'
import { api } from '@/lib/api'
import { useDialog } from '@/lib/dialog'
import { DECOR, Decor, decorByKey, GARDEN_SLOTS, TREE_STAGES } from '@/lib/game'
import { Notice, Progress } from '@/lib/ui'
import InfoTip from './InfoTip'
import { Sheet } from './Profile'
import { TreeArt } from './GardenPanel'

export interface GardenGame {
  sunlight: { balance: number }
  tree: { stage: number; name: string; activeDays: number; next: { name: string; at: number; remaining: number } | null }
  garden?: { ready: boolean; owned: string[]; slots: (string | null)[] }
}

function hasBatchim(word: string) {
  const c = word.charCodeAt(word.length - 1)
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0
}
const obj = (d: Decor) => `${d.name}${hasBatchim(d.name) ? '을' : '를'}`

export default function MyGarden<G extends GardenGame>({ game, onChange }: { game: G; onChange: (g: G) => void }) {
  const dialog = useDialog()
  const [pick, setPick] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const t = game.tree
  const g = game.garden ?? { ready: false, owned: [], slots: [] }
  const slots = Array.from({ length: GARDEN_SLOTS }, (_, i) => g.slots[i] ?? null)
  const placedCount = slots.filter(Boolean).length

  async function place(slot: number, key: string | null, done: string) {
    if (busy) return
    setBusy(true); setMsg(null)
    const r = await api<{ game: G }>('/api/me/game/garden', { method: 'PUT', body: { slot, item: key } })
    setBusy(false); setPick(null)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '처리하지 못했어요.' }); return }
    onChange(r.data.game)
    setMsg({ tone: 'success', text: done })
  }

  async function buy(slot: number, d: Decor) {
    if (busy) return
    const yes = await dialog.confirm({
      title: `${obj(d)} 받을까요?`,
      message: `햇빛 ${d.price}개를 써요. 받은 장식은 내 것이 되고, 햇빛으로 되돌릴 수 없어요.`,
      confirmText: '받기', icon: d.emoji,
    })
    if (!yes) return
    setBusy(true); setMsg(null)
    const b = await api<{ game: G }>('/api/me/game/purchase', { method: 'POST', body: { item: d.key } })
    if (!b.ok) { setBusy(false); setPick(null); setMsg({ tone: 'error', text: b.message || '받지 못했어요.' }); return }
    onChange(b.data.game)
    const r = await api<{ game: G }>('/api/me/game/garden', { method: 'PUT', body: { slot, item: d.key } })
    setBusy(false); setPick(null)
    if (!r.ok) { setMsg({ tone: 'error', text: `${obj(d)} 받았지만 놓지는 못했어요. 칸을 눌러 다시 놓아 주세요.` }); return }
    onChange(r.data.game)
    setMsg({ tone: 'success', text: `${obj(d)} 받아서 정원에 놓았어요.` })
  }

  const here = pick === null ? null : decorByKey(slots[pick])
  return (
    <section className="py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[14px] font-bold text-ink-700">나의 정원</p>
          <p className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-ink-900">{t.name}</p>
        </div>
        <p className="pb-1 text-right text-[13px] leading-relaxed text-ink-500">
          운동한 날 <span className="font-bold tabular-nums text-ink-900">{t.activeDays}일</span><br />
          장식 <span className="font-bold tabular-nums text-ink-900">{placedCount}</span> / {GARDEN_SLOTS}칸
        </p>
      </div>

      {/* 3×3: 가운데는 나무, 둘레 8칸은 장식 */}
      <div className="mx-auto mt-4 grid max-w-[360px] grid-cols-3 gap-2 rounded-2xl bg-brand-50 p-3">
        {Array.from({ length: 9 }, (_, pos) => {
          if (pos === 4) {
            return <div key="tree" className="flex aspect-square items-center justify-center"><TreeArt stage={t.stage} size={96} /></div>
          }
          const slot = pos < 4 ? pos : pos - 1
          const d = decorByKey(slots[slot])
          return (
            <button key={slot} type="button" disabled={!g.ready || busy} onClick={() => { setMsg(null); setPick(slot) }}
              aria-label={d ? `${slot + 1}번 칸: ${d.name}. 눌러서 바꾸기` : `${slot + 1}번 칸: 비어 있음. 눌러서 장식 놓기`}
              className={`flex aspect-square items-center justify-center rounded-xl leading-none active:bg-brand-200 disabled:opacity-60 ${d ? 'bg-paper text-[40px]' : 'border border-dashed border-ink-300 text-[22px] font-bold text-ink-300'}`}>
              <span aria-hidden="true">{d ? d.emoji : '+'}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4">
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
      <InfoTip label="정원 꾸미는 법" className="mt-2">
        <ul className="space-y-1">
          <li>나무는 운동한 날이 쌓이면 자라요. 햇빛으로는 자라지 않아요.</li>
          <li>칸을 누르고 햇빛으로 장식을 받아 놓아요. 받은 장식은 계속 내 것이에요.</li>
          <li>놓은 장식은 다른 칸으로 옮기거나 빼 둘 수 있어요.</li>
          {!g.ready && <li>정원 꾸미기는 곧 열려요.</li>}
        </ul>
      </InfoTip>

      {pick !== null && (
        <Sheet title={`${pick + 1}번 칸 꾸미기`} titleId="garden-pick-title" onClose={() => { if (!busy) setPick(null) }}>
          <p className="text-[13px] text-ink-500">보유 햇빛 <span className="font-bold tabular-nums text-ink-900">{game.sunlight.balance}개</span></p>
          {here && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-50 px-4 py-2">
              <span className="text-[15px] font-bold text-ink-900"><span className="mr-2 text-[22px]" aria-hidden="true">{here.emoji}</span>지금 {here.name}</span>
              <button type="button" disabled={busy} onClick={() => place(pick, null, `${obj(here)} 빼 두었어요.`)} className="pill-action text-ink-900 underline">빼 두기</button>
            </div>
          )}
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {DECOR.map((d) => {
              const owned = g.owned.includes(d.key)
              const at = slots.indexOf(d.key)
              const isHere = at === pick
              const short = !owned && game.sunlight.balance < d.price
              return (
                <li key={d.key} className="flex min-h-[60px] items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="text-[28px] leading-none" aria-hidden="true">{d.emoji}</span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold text-ink-900">{d.name}</span>
                      <span className="block text-[12px] text-ink-500">
                        {owned ? (isHere ? '이 칸에 있어요' : at >= 0 ? `${at + 1}번 칸에 있어요` : '가지고 있어요') : `햇빛 ${d.price}개`}
                      </span>
                    </span>
                  </span>
                  {isHere ? (
                    <span className="shrink-0 text-[13px] font-semibold text-ink-500">놓여 있음</span>
                  ) : owned ? (
                    <button type="button" disabled={busy}
                      onClick={() => place(pick, d.key, at >= 0 ? `${obj(d)} ${pick + 1}번 칸으로 옮겼어요.` : `${obj(d)} 놓았어요.`)}
                      className="shrink-0 rounded-lg border border-ink-900 px-4 py-2 text-[14px] font-bold text-ink-900 active:bg-ink-50 disabled:opacity-50">
                      {at >= 0 ? '여기로 옮기기' : '놓기'}
                    </button>
                  ) : (
                    <button type="button" disabled={busy || short} onClick={() => buy(pick, d)}
                      className="shrink-0 rounded-lg bg-ink-900 px-4 py-2 text-[14px] font-bold text-paper active:bg-ink-700 disabled:bg-ink-300">
                      {short ? '햇빛 모자람' : '받기'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </Sheet>
      )}
    </section>
  )
}
