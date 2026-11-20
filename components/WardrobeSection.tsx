'use client'

// 프로필 탭 › 캐릭터 꾸미기(11-20 정원에서 옮김) — 햇빛으로 사서 입고 벗습니다(11-19 TK).
// 11-20 TK: 옷(유니폼·상의·하의·신발)은 통그림 한 벌만, 꾸미기(모자·안경 등)는 운동복에서만 보임.
// 가격·잔액·가진 아이템 확인과 "옷 한 벌만" 규칙은 모두 서버가 합니다. 이 화면은 보여 주고 요청만 보냅니다.
import { useCallback, useState } from 'react'
import { api } from '@/lib/api'
import { WARDROBE_OPEN, CLOTHES, Equipped, isClothes, Item, itemIcon, ITEMS, Slot, SLOT_LABEL, SLOTS, wornClothes } from '@/lib/game'
import { Notice } from '@/lib/ui'
import CharacterFigure from './CharacterFigure'
import InfoTip from './InfoTip'
import { Sheet } from './Profile'

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

// 탭(11-20 TK): 옷(운동복·유니폼) → 상의 → 하의 → 신발 → 모자 … 상의·하의·신발도 통그림 옷이라 한 벌 규칙은 같음
type Tab = 'clothes' | Slot
const TABS: Tab[] = ['clothes', ...CLOTHES, ...SLOTS.filter((s) => !isClothes(s))]
const CLOTHES_LABEL: Partial<Record<Slot, string>> = { top: '상의', bottom: '하의', shoes: '신발' }
const tabLabel = (t: Tab) => (t === 'clothes' ? '옷' : CLOTHES_LABEL[t] ?? SLOT_LABEL[t])
const isClothesTab = (t: Tab) => t === 'clothes' || isClothes(t)

export default function WardrobeSection<G extends WardrobeGame>({ game, onChange, bare = false }: { game: G; onChange: (g: G) => void; bare?: boolean }) {
  const [preview, setPreview] = useState<Item | null>(null) // 안 산 옷·아이템을 누르면 입어 본 모습을 먼저 보여 줌(11-20 TK)
  const closePreview = useCallback(() => setPreview(null), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [tab, setTab] = useState<Tab>('clothes')
  const { owned, equipped } = game.character
  const worn = wornClothes(equipped)
  const uni = worn?.uniform ? worn : null // 유니폼을 입으면 옷 탭 말고는 잠김(11-20 TK)
  const cur: Tab = uni && tab !== 'clothes' ? 'clothes' : tab

  async function equip(slot: Slot, key: string | null) {
    const r = await api<{ game: G }>('/api/me/game/equip', { method: 'PUT', body: { slot, item: key } })
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '처리하지 못했어요.' }); return null }
    onChange(r.data.game)
    return r.data.game
  }

  const putOnText = (it: Item, bought: boolean) => `${obj(it.name)} ${bought ? '사서 ' : ''}입었어요.`

  async function press(it: Item) {
    if (busy) return
    setMsg(null)
    const have = owned.includes(it.key)
    const on = equipped[it.slot] === it.key
    if (!have) { setPreview(it); return }
    setBusy(it.key)
    const done = await equip(it.slot, on ? null : it.key)
    setBusy(null)
    if (done) setMsg({ tone: 'success', text: on ? `${obj(it.name)} 벗었어요.` : putOnText(it, false) })
  }

  /** 미리보기 창에서 사기 → 바로 입기 */
  async function buy(it: Item) {
    if (busy || game.sunlight.balance < it.price) return
    setMsg(null)
    setBusy(it.key)
    const b = await api<{ game: G }>('/api/me/game/purchase', { method: 'POST', body: { item: it.key } })
    if (!b.ok) { setBusy(null); setPreview(null); setMsg({ tone: 'error', text: b.message || '사지 못했어요.' }); return }
    onChange(b.data.game)
    const done = await equip(it.slot, it.key)
    setBusy(null)
    setPreview(null)
    if (done) setMsg({ tone: 'success', text: putOnText(it, true) })
  }

  /** 입었을 때 모습 — 서버 규칙과 같게: 옷은 한 벌만, 꾸미기를 입으면 유니폼은 벗음 */
  function tryOn(it: Item): Equipped {
    const next: Equipped = { ...equipped }
    if (isClothes(it.slot)) for (const s of CLOTHES) next[s] = null
    else if (uni) next[uni.slot] = null
    next[it.slot] = it.key
    return next
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
  const items = (t: Tab) => ITEMS.filter((i) => (t === 'clothes' ? !!i.uniform : i.slot === t && !i.uniform))
    .filter((i) => i.key !== 'top_tshirt' || owned.includes(i.key))
  const list = items(cur)
  const wearingIn = (t: Tab) => (t === 'clothes' ? !!uni : isClothes(t) ? worn?.slot === t && !uni : !uni && !!equipped[t]) // 유니폼을 입은 동안 꾸미기는 안 보이므로 점도 안 찍음
  const card = (on: boolean) => `flex w-full flex-col items-center gap-1 rounded-xl border-2 px-1 pb-2 pt-2 disabled:opacity-60 ${on ? 'border-ink-900 bg-brand-300' : 'border-line bg-sheet'}`

  if (!WARDROBE_OPEN) return (
    <section className={bare ? 'pb-6 pt-2' : 'border-t border-line py-6'}>
      <p className="text-[14px] font-bold text-ink-700">캐릭터 꾸미기</p>
      <div className="mt-3 rounded-2xl bg-brand-50 px-5 py-6 text-center">
        <p className="text-[15px] font-bold text-ink-900">업데이트 중이에요</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-600">옷과 꾸미기 아이템을 더 예쁘게 바꾸고 있어요. 조금만 기다려 주세요.<br />가지고 있는 햇빛과 산 아이템은 그대로 남아 있어요.</p>
      </div>
    </section>
  )

  return (
    <section className={bare ? 'pb-6 pt-2' : 'border-t border-line py-6'}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[14px] font-bold text-ink-700">캐릭터 꾸미기</p>
          <p className="mt-1 text-[13px] text-ink-500">햇빛으로 옷과 꾸미기 아이템을 사서 입어요.</p>
          <InfoTip label="꾸미기 안내" className="mt-1">
            <ul className="space-y-1">
              <li>운동복은 기본 옷이에요. 유니폼·상의·하의·신발은 햇빛으로 사서 입고, 옷은 한 번에 한 벌만 입어요.</li>
              <li>모자·안경 같은 꾸미기는 운동복이나 상의·하의·신발 아이템 위에 함께 입을 수 있어요.</li>
              <li>유니폼을 입는 동안에는 다른 탭이 잠기고 꾸미기도 안 보여요. 운동복을 고르면 다시 열려요.</li>
              <li>산 아이템은 계속 내 것이에요. 입은 아이템을 다시 누르면 벗어요.</li>
            </ul>
          </InfoTip>
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
              const sel = t === cur
              const locked = !!uni && t !== 'clothes'
              return (
                <button key={t} type="button" role="tab" aria-selected={sel} disabled={locked} aria-disabled={locked} onClick={() => setTab(t)}
                  title={locked ? '운동복을 입으면 열려요' : undefined}
                  className={`relative shrink-0 rounded-full border-2 px-3.5 py-1.5 text-[13px] font-bold ${sel ? 'border-ink-900 bg-ink-900 text-white' : locked ? 'border-line bg-ink-50 text-ink-300' : 'border-line bg-sheet text-ink-700'}`}>
                  {tabLabel(t)}
                  {wearingIn(t) && <span aria-label="입는 중" className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${sel ? 'bg-brand-300' : 'bg-ink-900'}`} />}
                </button>
              )
            })}
          </div>

          <div role="tabpanel" aria-label={tabLabel(cur)}>
            {uni && (
              <p className="mb-2 rounded-xl bg-brand-50 px-3 py-2 text-[13px] text-ink-700">
                지금은 <span className="font-bold">{obj(uni.name)}</span> 입고 있어서 다른 탭이 잠겨 있어요. 운동복을 고르면 상의·하의·신발과 꾸미기를 쓸 수 있어요.
              </p>
            )}
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
              {cur === 'clothes' && (
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
                const on = isClothesTab(cur) ? worn?.key === it.key : equipped[it.slot] === it.key
                const short = !have && game.sunlight.balance < it.price
                return (
                  <li key={it.key}>
                    <button type="button" onClick={() => press(it)} disabled={!!busy} aria-pressed={on}
                      aria-label={`${it.name}, ${on ? '입는 중, 눌러서 벗기' : have ? '가지고 있음, 눌러서 입기' : `햇빛 ${it.price}개로 사기`}`}
                      className={card(on)}>
                      {isClothesTab(cur)
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
          {preview && (() => {
            const short = Math.max(0, preview.price - game.sunlight.balance)
            return (
              <Sheet title="입어 보기" titleId="wardrobe-preview-title" onClose={closePreview}>
                <div className="flex flex-col items-center gap-3">
                  <div className="flex w-full justify-center gap-6 rounded-2xl bg-brand-50 py-5">
                    <div className="flex flex-col items-center gap-1">
                      <CharacterFigure charKey={game.characterKey} outfit={null} equipped={equipped} width={88} label="지금 모습" />
                      <span className="text-[12px] text-ink-500">지금</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <CharacterFigure charKey={game.characterKey} outfit={null} equipped={tryOn(preview)} width={136} label={`${obj(preview.name)} 입은 모습`} />
                      <span className="text-[12px] font-bold text-ink-900">{preview.name}</span>
                    </div>
                  </div>
                  <p className="text-[14px] text-ink-700">햇빛 <span className="font-bold text-ink-900">{preview.price}개</span> · 보유 {game.sunlight.balance}개</p>
                  {preview.uniform && <p className="text-[12px] text-ink-500">유니폼을 입는 동안에는 모자·안경 같은 꾸미기가 보이지 않아요.</p>}
                  <p className="text-[12px] text-ink-500">산 아이템은 계속 내 것이고, 햇빛으로 되돌릴 수 없어요.</p>
                  <div className="flex w-full gap-2">
                    <button type="button" onClick={closePreview} className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 border-line bg-sheet text-[15px] font-bold text-ink-700">닫기</button>
                    <button type="button" onClick={() => buy(preview)} disabled={!!busy || short > 0}
                      className="flex min-h-[48px] flex-[2] items-center justify-center rounded-xl bg-ink-900 text-[15px] font-bold text-paper disabled:bg-ink-300">
                      {busy === preview.key ? '사는 중' : short > 0 ? `햇빛 ${short}개 모자라요` : `햇빛 ${preview.price}개로 사서 입기`}
                    </button>
                  </div>
                </div>
              </Sheet>
            )
          })()}
        </div>
      </div>
    </section>
  )
}
