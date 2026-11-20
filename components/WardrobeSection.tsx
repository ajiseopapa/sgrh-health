'use client'

// 정원 › 캐릭터 꾸미기 — 햇빛으로 사서 입고 벗습니다(11-19 TK).
// 11-20 TK: 옷(유니폼·상의·하의·신발)은 통그림 한 벌만, 꾸미기(모자·안경 등)는 운동복에서만 보임.
// 가격·잔액·가진 아이템 확인과 "옷 한 벌만" 규칙은 모두 서버가 합니다. 이 화면은 보여 주고 요청만 보냅니다.
import { useState } from 'react'
import { api } from '@/lib/api'
import { useDialog } from '@/lib/dialog'
import { CLOTHES, Equipped, isClothes, Item, itemIcon, ITEMS, Slot, SLOT_LABEL, SLOTS, wornClothes } from '@/lib/game'
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

type Tab = 'clothes' | Slot
const TABS: Tab[] = ['clothes', ...SLOTS.filter((s) => !isClothes(s))]
const tabLabel = (t: Tab) => (t === 'clothes' ? '옷' : SLOT_LABEL[t])

export default function WardrobeSection<G extends WardrobeGame>({ game, onChange }: { game: G; onChange: (g: G) => void }) {
  const dialog = useDialog()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [tab, setTab] = useState<Tab>('clothes')
  const { owned, equipped } = game.character
  const worn = wornClothes(equipped)

  async function equip(slot: Slot, key: string | null) {
    const r = await api<{ game: G }>('/api/me/game/equip', { method: 'PUT', body: { slot, item: key } })
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '처리하지 못했어요.' }); return null }
    onChange(r.data.game)
    return r.data.game
  }

  /** 입을 때 안내 — 옷↔꾸미기가 서로 바뀌는 경우를 알려 줌 */
  function putOnText(it: Item, bought: boolean) {
    const head = bought ? `${obj(it.name)} 사서 ` : `${obj(it.name)} `
    if (!isClothes(it.slot) && worn) return `운동복으로 갈아입고 ${head}입었어요.`
    return `${head}입었어요.`
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
        message: `햇빛 ${it.price}개를 써요. 산 아이템은 계속 내 것이고, 햇빛으로 되돌릴 수 없어요.`
          + (!isClothes(it.slot) && worn ? ` 입으면 ${worn.name}에서 운동복으로 갈아입어요.` : ''),
        confirmText: '사기',
      })
      if (!yes) return
      setBusy(it.key)
      const b = await api<{ game: G }>('/api/me/game/purchase', { method: 'POST', body: { item: it.key } })
      if (!b.ok) { setBusy(null); setMsg({ tone: 'error', text: b.message || '사지 못했어요.' }); return }
      onChange(b.data.game)
      const done = await equip(it.slot, it.key)
      setBusy(null)
      if (done) setMsg({ tone: 'success', text: putOnText(it, true) })
      return
    }
    setBusy(it.key)
    const done = await equip(it.slot, on ? null : it.key)
    setBusy(null)
    if (done) setMsg({ tone: 'success', text: on ? `${obj(it.name)} 벗었어요.` : putOnText(it, false) })
  }

  /** 운동복으로 — 입은 옷을 벗음 */
  async function toWorkout() {
    if (busy || !worn) return
    setMsg(null); setBusy('workout')
    const done = await equip(worn.slot, null)
    setBusy(null)
    if (done) setMsg({ tone: 'success', text: '운동복으로 갈아입었어요.' })
  }

  // 라임 반팔은 운동복과 같아 새로 팔지 않음(이미 산 사람에게만 보임)
  const items = (t: Tab) => ITEMS.filter((i) => (t === 'clothes' ? CLOTHES.includes(i.slot) : i.slot === t))
    .filter((i) => i.key !== 'top_tshirt' || owned.includes(i.key))
    .sort((a, b) => (t === 'clothes' ? Number(!!b.uniform) - Number(!!a.uniform) : 0))
  const list = items(tab)
  const wearingIn = (t: Tab) => (t === 'clothes' ? !!worn : !worn && !!equipped[t]) // 옷을 입은 동안 꾸미기는 안 보이므로 점도 안 찍음
  const card = (on: boolean) => `flex w-full flex-col items-center gap-1 rounded-xl border-2 px-1 pb-2 pt-2 disabled:opacity-60 ${on ? 'border-ink-900 bg-brand-300' : 'border-line bg-sheet'}`

  return (
    <section className="border-t border-line py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[14px] font-bold text-ink-700">캐릭터 꾸미기</p>
          <p className="mt-1 text-[13px] text-ink-500">햇빛으로 옷과 꾸미기 아이템을 사서 입어요.</p>
        </div>
        <p className="shrink-0 pb-0.5 text-[13px] text-ink-500">보유 햇빛 <span className="font-bold tabular-nums text-ink-900">{game.sunlight.balance}개</span></p>
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-x-10">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-brand-50 py-4 lg:sticky lg:top-20">
          <CharacterFigure charKey={game.characterKey} outfit={null} equipped={equipped} width={128} label="지금 내 캐릭터" />
          <p className="text-[12px] font-bold text-ink-700">{worn ? worn.name : '운동복'}</p>
        </div>

        <div className="mt-4 space-y-4 lg:mt-0">
          <div role="tablist" aria-label="꾸미기 칸" className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const sel = t === tab
              return (
                <button key={t} type="button" role="tab" aria-selected={sel} onClick={() => setTab(t)}
                  className={`relative shrink-0 rounded-full border-2 px-3.5 py-1.5 text-[13px] font-bold ${sel ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-sheet text-ink-700'}`}>
                  {tabLabel(t)}
                  {wearingIn(t) && <span aria-label="입는 중" className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${sel ? 'bg-brand-300' : 'bg-ink-900'}`} />}
                </button>
              )
            })}
          </div>

          <div role="tabpanel" aria-label={tabLabel(tab)}>
            {tab !== 'clothes' && worn && (
              <p className="mb-2 rounded-xl bg-brand-50 px-3 py-2 text-[13px] text-ink-700">
                꾸미기는 운동복에서만 보여요. 지금은 <span className="font-bold">{obj(worn.name)}</span> 입고 있어서, 꾸미기를 입으면 운동복으로 갈아입어요.
              </p>
            )}
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
              {tab === 'clothes' && (
                <li>
                  <button type="button" onClick={toWorkout} disabled={!!busy} aria-pressed={!worn}
                    aria-label={`운동복, 기본 옷${!worn ? ', 입는 중' : ', 눌러서 갈아입기'}`} className={card(!worn)}>
                    <CharacterFigure charKey={game.characterKey} outfit={null} equipped={null} width={48} label="" />
                    <span className="text-[12px] font-bold leading-tight text-ink-900">운동복</span>
                    <span className={`text-[11px] leading-tight ${!worn ? 'font-bold text-ink-900' : 'text-ink-500'}`}>
                      {busy === 'workout' ? '처리 중' : !worn ? '입는 중' : '기본'}
                    </span>
                  </button>
                </li>
              )}
              {list.map((it) => {
                const have = owned.includes(it.key)
                const on = tab === 'clothes' ? worn?.key === it.key : equipped[it.slot] === it.key
                const short = !have && game.sunlight.balance < it.price
                return (
                  <li key={it.key}>
                    <button type="button" onClick={() => press(it)} disabled={!!busy} aria-pressed={on}
                      aria-label={`${it.name}, ${on ? '입는 중, 눌러서 벗기' : have ? '가지고 있음, 눌러서 입기' : `햇빛 ${it.price}개로 사기`}`}
                      className={card(on)}>
                      {tab === 'clothes'
                        ? <span className={short ? 'opacity-50' : ''}><CharacterFigure charKey={game.characterKey} outfit={null} equipped={{ [it.slot]: it.key }} width={48} label="" /></span>
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={itemIcon(it)} alt="" width={56} height={56} className={`h-14 w-14 object-contain ${short ? 'opacity-50' : ''}`} />}
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
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <InfoTip label="꾸미기 안내">
            <ul className="space-y-1">
              <li>운동복은 기본 옷이에요. 유니폼과 다른 옷은 햇빛으로 사서 입어요. 옷은 한 번에 한 벌만 입어요.</li>
              <li>모자·안경 같은 꾸미기는 운동복을 입었을 때만 보여요. 옷을 입는 동안에도 고른 꾸미기는 남아 있다가, 운동복으로 돌아오면 다시 보여요.</li>
              <li>산 아이템은 계속 내 것이에요. 입은 아이템을 다시 누르면 벗어요.</li>
            </ul>
          </InfoTip>
        </div>
      </div>
    </section>
  )
}
