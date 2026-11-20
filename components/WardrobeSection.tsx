'use client'

// 정원 › 캐릭터 꾸미기 — 햇빛으로 아이템을 사서 입고 벗습니다(11-19 TK). 칸마다 1개.
// 가격·잔액·가진 아이템 확인은 모두 서버가 합니다. 이 화면은 보여 주고 요청만 보냅니다.
import { useState } from 'react'
import { api } from '@/lib/api'
import { useDialog } from '@/lib/dialog'
import { DEFAULT_OUTFIT, Equipped, Item, itemIcon, ITEMS, Slot, SLOT_LABEL, SLOTS } from '@/lib/game'
import { Notice } from '@/lib/ui'
import CharacterFigure from './CharacterFigure'
import InfoTip from './InfoTip'

export interface WardrobeGame {
  sunlight: { balance: number }
  character: { owned: string[]; equipped: Equipped }
  characterKey: string | null
  outfitKey?: string | null
}

function hasBatchim(word: string) {
  const c = word.charCodeAt(word.length - 1)
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0
}
const obj = (w: string) => `${w}${hasBatchim(w) ? '을' : '를'}`

export default function WardrobeSection<G extends WardrobeGame>({ game, onChange }: { game: G; onChange: (g: G) => void }) {
  const dialog = useDialog()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const { owned, equipped } = game.character
  const outfit = game.outfitKey ?? DEFAULT_OUTFIT

  async function equip(it: Item, on: boolean) {
    const r = await api<{ game: G }>('/api/me/game/equip', { method: 'PUT', body: { slot: it.slot, item: on ? it.key : null } })
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '처리하지 못했어요.' }); return null }
    onChange(r.data.game)
    return r.data.game
  }

  async function press(it: Item) {
    if (busy) return
    setMsg(null)
    const have = owned.includes(it.key)
    const on = equipped[it.slot] === it.key
    if (!have) {
      if (game.sunlight.balance < it.price) { setMsg({ tone: 'error', text: `햇빛이 ${it.price - game.sunlight.balance}개 모자라요.` }); return }
      const yes = await dialog.confirm({
        title: `${obj(it.name)} 살까요?`,
        message: `햇빛 ${it.price}개를 써요. 산 아이템은 계속 내 것이고, 햇빛으로 되돌릴 수 없어요.`,
        confirmText: '사기',
      })
      if (!yes) return
      setBusy(it.key)
      const b = await api<{ game: G }>('/api/me/game/purchase', { method: 'POST', body: { item: it.key } })
      if (!b.ok) { setBusy(null); setMsg({ tone: 'error', text: b.message || '사지 못했어요.' }); return }
      onChange(b.data.game)
      const done = await equip(it, true)
      setBusy(null)
      if (done) setMsg({ tone: 'success', text: `${obj(it.name)} 사서 입었어요.` })
      return
    }
    setBusy(it.key)
    const done = await equip(it, !on)
    setBusy(null)
    if (done) setMsg({ tone: 'success', text: on ? `${obj(it.name)} 벗었어요.` : `${obj(it.name)} 입었어요.` })
  }

  const groups = SLOTS.map((slot) => ({ slot, items: ITEMS.filter((i) => i.slot === slot) })).filter((g) => g.items.length)
  // 칸별 탭(11-20 TK): 한 번에 한 칸만 보여 위아래로 길게 스크롤하지 않게
  const [tab, setTab] = useState<Slot>(groups[0]?.slot ?? 'hat')
  const grp = groups.find((g) => g.slot === tab) ?? groups[0]

  return (
    <section className="border-t border-line py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[14px] font-bold text-ink-700">캐릭터 꾸미기</p>
          <p className="mt-1 text-[13px] text-ink-500">햇빛으로 아이템을 사서 입어요. 칸마다 하나씩 입을 수 있어요.</p>
        </div>
        <p className="shrink-0 pb-0.5 text-[13px] text-ink-500">보유 햇빛 <span className="font-bold tabular-nums text-ink-900">{game.sunlight.balance}개</span></p>
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-x-10">
        <div className="flex justify-center rounded-2xl bg-brand-50 py-4 lg:sticky lg:top-20">
          <CharacterFigure charKey={game.characterKey} outfit={outfit} equipped={equipped} width={128} label="지금 내 캐릭터" />
        </div>

        <div className="mt-4 space-y-4 lg:mt-0">
          <div role="tablist" aria-label="꾸미기 칸" className="flex flex-wrap gap-1.5">
            {groups.map((g) => {
              const sel = g.slot === grp.slot
              const wearing = !!equipped[g.slot]
              return (
                <button key={g.slot} type="button" role="tab" aria-selected={sel} onClick={() => setTab(g.slot)}
                  className={`relative shrink-0 rounded-full border-2 px-3.5 py-1.5 text-[13px] font-bold ${sel ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-sheet text-ink-700'}`}>
                  {SLOT_LABEL[g.slot]}
                  {wearing && <span aria-label="입는 중" className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${sel ? 'bg-brand-300' : 'bg-ink-900'}`} />}
                </button>
              )
            })}
          </div>
          {grp && (
            <div key={grp.slot} role="tabpanel" aria-label={SLOT_LABEL[grp.slot]}>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                {grp.items.map((it) => {
                  const have = owned.includes(it.key)
                  const on = equipped[it.slot] === it.key
                  const short = !have && game.sunlight.balance < it.price
                  return (
                    <li key={it.key}>
                      <button type="button" onClick={() => press(it)} disabled={!!busy} aria-pressed={on}
                        aria-label={`${it.name}, ${on ? '입는 중, 눌러서 벗기' : have ? '가지고 있음, 눌러서 입기' : `햇빛 ${it.price}개로 사기`}`}
                        className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 px-1 pb-2 pt-2 disabled:opacity-60 ${on ? 'border-ink-900 bg-brand-300' : 'border-line bg-sheet'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={itemIcon(it)} alt="" width={56} height={56} className={`h-14 w-14 object-contain ${short ? 'opacity-50' : ''}`} />
                        <span className="text-[12px] font-bold leading-tight text-ink-900">{it.name}</span>
                        <span className={`text-[11px] leading-tight ${on ? 'font-bold text-ink-900' : 'text-ink-500'}`}>
                          {busy === it.key ? '처리 중' : on ? '입는 중' : have ? '가지고 있음' : `☀ ${it.price}`}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <InfoTip label="꾸미기 안내">
            <ul className="space-y-1">
              <li>아이템을 누르면 햇빛으로 사서 바로 입어요. 산 아이템은 계속 내 것이에요.</li>
              <li>입은 아이템을 다시 누르면 벗어요. 가진 아이템은 언제든 다시 입을 수 있어요.</li>
              <li>상의·하의·신발 아이템을 입으면 지금 의상의 그 부분만 바뀌어요. 벗으면 의상 그대로 돌아와요.</li>
              <li>의상은 내 프로필에서 자유롭게 바꿀 수 있어요.</li>
            </ul>
          </InfoTip>
        </div>
      </div>
    </section>
  )
}
