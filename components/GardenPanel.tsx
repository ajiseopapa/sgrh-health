'use client'

// 도전 › 정원 — 나의 나무 · 햇빛 · 내 캐릭터 · 우리 부서 정원
// 숫자 계산과 잔액 확인은 모두 서버가 합니다. 이 화면은 보여 주고 요청만 보냅니다.
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useMe } from '@/lib/me'
import { DEFAULT_LOOK, ITEMS, itemByKey, Slot, SLOT_LABEL, SUN_DAY, SUN_GOAL, SUN_WEEK3, TREE_STAGES } from '@/lib/game'
import { Loading, NeedLogin, Notice, Progress, Section } from '@/lib/ui'

interface Game {
  today: string
  launchDate: string
  sunlight: { earned: number; spent: number; balance: number; shortfall: number }
  ledger: { type: 'earn' | 'spend'; key: string; date: string; label: string; points: number }[]
  tree: { stage: number; name: string; activeDays: number; next: { stage: number; name: string; at: number; remaining: number } | null }
  character: { owned: string[]; equipped: Record<Slot, string | null> }
  showInFeed: boolean
}
interface Garden {
  department: { id: string; name: string } | null
  week?: { start: string; end: string; contributions: number; participants: number; goal: number | null; status: 'ok' | 'no_headcount' | 'check_needed'; achieved: boolean }
  decorations?: { week: string; emoji: string; name: string }[]
}

export default function GardenPanel() {
  const { me, mustChangePin, loaded, requireMe } = useMe()
  const ready = loaded && !!me && !mustChangePin
  const [game, setGame] = useState<Game | null>(null)
  const [garden, setGarden] = useState<Garden | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!ready) return
    const [g, d] = await Promise.all([api<Game>('/api/me/game'), api<Garden>('/api/me/garden')])
    if (g.ok) setGame(g.data); else setError(g.message || '불러오지 못했어요.')
    if (d.ok) setGarden(d.data)
  }, [ready])
  useEffect(() => { load() }, [load])

  if (loaded && !ready) return <NeedLogin text="본인 확인을 하면 나의 나무와 캐릭터, 우리 부서 정원을 볼 수 있어요." onLogin={() => requireMe()} />
  if (error) return <div className="py-6"><Notice tone="error">{error}</Notice></div>
  if (!game) return <div className="py-6"><Loading /></div>

  return (
    <div>
      <TreeSection game={game} />
      <SunSection game={game} />
      <CharacterSection game={game} onChange={setGame} />
      <GardenSection garden={garden} />
      <FeedToggle game={game} onChange={(v) => setGame({ ...game, showInFeed: v })} />
    </div>
  )
}

// ── 나의 나무 ──
function TreeSection({ game }: { game: Game }) {
  const t = game.tree
  return (
    <section className="py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[14px] font-bold text-ink-700">나의 나무</p>
          <p className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-ink-900">{t.name}</p>
          <p className="mt-1 text-[14px] text-ink-600">운동한 날 <span className="font-bold tabular-nums text-ink-900">{t.activeDays}일</span></p>
        </div>
        <TreeArt stage={t.stage} />
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
    </section>
  )
}

/** 나무 그림(사물이라 SVG). 단계마다 줄기·잎 덩어리가 늘어납니다. */
export function TreeArt({ stage, size = 112 }: { stage: number; size?: number }) {
  const leaf = ['#D8F36A', '#C6E44A', '#A9C82E']
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`${TREE_STAGES[stage - 1]?.name ?? ''} 그림`}
      className="shrink-0 motion-safe:animate-[sway_4s_ease-in-out_infinite] origin-bottom">
      <ellipse cx="60" cy="110" rx="40" ry="6" fill="#E2E1D9" />
      {stage === 1 && (
        <g>
          <path d="M60 108 V84" stroke="#3C4743" strokeWidth="4" strokeLinecap="round" />
          <path d="M60 90 C48 88 42 78 44 70 C54 72 60 80 60 90Z" fill={leaf[1]} stroke="#202D29" strokeWidth="2" />
          <path d="M60 86 C72 84 78 74 76 66 C66 68 60 76 60 86Z" fill={leaf[0]} stroke="#202D29" strokeWidth="2" />
        </g>
      )}
      {stage >= 2 && <path d={`M60 108 V${stage === 2 ? 66 : stage === 3 ? 56 : 50}`} stroke="#3C4743" strokeWidth={stage === 2 ? 6 : 9} strokeLinecap="round" />}
      {stage === 2 && (
        <g stroke="#202D29" strokeWidth="2">
          <circle cx="60" cy="56" r="20" fill={leaf[1]} />
          <circle cx="48" cy="66" r="12" fill={leaf[0]} />
          <circle cx="72" cy="66" r="12" fill={leaf[0]} />
        </g>
      )}
      {stage === 3 && (
        <g stroke="#202D29" strokeWidth="2">
          <circle cx="60" cy="40" r="24" fill={leaf[2]} />
          <circle cx="40" cy="56" r="17" fill={leaf[1]} />
          <circle cx="80" cy="56" r="17" fill={leaf[1]} />
          <circle cx="60" cy="60" r="16" fill={leaf[0]} />
        </g>
      )}
      {stage === 4 && (
        <g stroke="#202D29" strokeWidth="2">
          <circle cx="60" cy="32" r="26" fill={leaf[2]} />
          <circle cx="34" cy="48" r="20" fill={leaf[1]} />
          <circle cx="86" cy="48" r="20" fill={leaf[1]} />
          <circle cx="46" cy="66" r="16" fill={leaf[0]} />
          <circle cx="74" cy="66" r="16" fill={leaf[0]} />
          <circle cx="52" cy="30" r="4" fill="#FF6B6B" />
          <circle cx="76" cy="44" r="4" fill="#FF6B6B" />
          <circle cx="40" cy="56" r="4" fill="#FF6B6B" />
        </g>
      )}
    </svg>
  )
}

// ── 햇빛 ──
function SunSection({ game }: { game: Game }) {
  const [all, setAll] = useState(false)
  const s = game.sunlight
  const rows = all ? game.ledger : game.ledger.slice(0, 5)
  return (
    <Section title="햇빛">
      <div className="flex items-end justify-between gap-4">
        <p className="num text-[48px] leading-none text-ink-900">
          {s.balance}<span className="ml-1 text-[18px] font-black tracking-normal text-ink-500">개</span>
        </p>
        <p className="pb-1 text-right text-[13px] leading-relaxed text-ink-500">
          받은 햇빛 <span className="font-bold tabular-nums text-ink-900">{s.earned}</span><br />
          쓴 햇빛 <span className="font-bold tabular-nums text-ink-900">{s.spent}</span>
        </p>
      </div>
      {s.shortfall > 0 && (
        <div className="mt-3"><Notice tone="info">기록이 고쳐져 받은 햇빛이 줄었어요. 산 아이템은 그대로이고, {s.shortfall}개를 더 모으면 다시 살 수 있어요.</Notice></div>
      )}
      <ul className="mt-4 space-y-1 text-[13px] leading-relaxed text-ink-600">
        <li>운동한 날 +{SUN_DAY} (하루 여러 번 기록해도 1번)</li>
        <li>한 주에 3일 운동 +{SUN_WEEK3} · 주간 목표 달성 +{SUN_GOAL}</li>
        <li>{game.launchDate.slice(5).replace('-', '.')} 이후 기록부터 셉니다. 기록을 고치거나 지우면 다시 계산해요.</li>
      </ul>
      {game.ledger.length > 0 && (
        <>
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {rows.map((l) => (
              <li key={l.key} className="flex items-center justify-between py-2.5 text-[14px]">
                <span className="text-ink-700"><span className="mr-2 tabular-nums text-ink-500">{l.date.slice(5).replace('-', '.')}</span>{l.label}</span>
                <span className={`font-bold tabular-nums ${l.points > 0 ? 'text-brand-600' : 'text-ink-900'}`}>{l.points > 0 ? `+${l.points}` : l.points}</span>
              </li>
            ))}
          </ul>
          {game.ledger.length > 5 && (
            <button type="button" onClick={() => setAll(!all)} className="pill-action -ml-2.5 text-ink-900 underline">
              {all ? '접기' : `내역 모두 보기 (${game.ledger.length})`}
            </button>
          )}
        </>
      )}
    </Section>
  )
}

// ── 내 캐릭터 ──
export function CharacterArt({ equipped, size = 'lg' }: { equipped: Record<Slot, string | null>; size?: 'lg' | 'sm' }) {
  const hat = itemByKey(equipped.hat)?.emoji
  const top = itemByKey(equipped.top)?.emoji ?? DEFAULT_LOOK.top
  const shoes = itemByKey(equipped.shoes)?.emoji
  const big = size === 'lg'
  const line = big ? 'h-[40px] text-[36px]' : 'h-[16px] text-[14px]'
  return (
    <div className={`flex shrink-0 flex-col items-center leading-none ${big ? 'w-[72px]' : 'w-[18px]'}`} aria-hidden="true">
      <span className={`${line} flex items-end`}>{hat ?? ''}</span>
      <span className={`${line} -mt-1`}>{DEFAULT_LOOK.head}</span>
      <span className={line}>{top}</span>
      <span className={`${line} flex items-start`}>{shoes ? <>{shoes}</> : ''}</span>
    </div>
  )
}

function CharacterSection({ game, onChange }: { game: Game; onChange: (g: Game) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const { owned, equipped } = game.character

  async function act(key: string, kind: 'buy' | 'equip' | 'unequip') {
    if (busy) return // 연속 누름 방지(서버도 중복을 막음)
    const item = itemByKey(key)!
    setBusy(key); setMsg(null)
    const r = kind === 'buy'
      ? await api<{ game: Game }>('/api/me/game/purchase', { method: 'POST', body: { item: key } })
      : await api<{ game: Game }>('/api/me/game/equip', { method: 'PUT', body: { slot: item.slot, item: kind === 'equip' ? key : null } })
    setBusy(null)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '처리하지 못했어요.' }); return }
    onChange(r.data.game)
    const obj = `${item.name}${hasBatchim(item.name) ? '을' : '를'}`
    setMsg({ tone: 'success', text: kind === 'buy' ? `${obj} 해금했어요.` : kind === 'equip' ? `${obj} 입었어요.` : `${obj} 벗었어요.` })
  }

  return (
    <Section title="내 캐릭터">
      <div className="flex items-center gap-5">
        <CharacterArt equipped={equipped} />
        <p className="text-[14px] leading-relaxed text-ink-600">햇빛으로 모자·상의·운동화를 해금하고 자유롭게 입고 벗을 수 있어요. 꾸미기는 모양만 바뀌어요.</p>
      </div>
      <ul className="mt-4 divide-y divide-line border-t border-line">
        {ITEMS.map((it) => {
          const have = owned.includes(it.key)
          const on = equipped[it.slot] === it.key
          const canBuy = game.sunlight.balance >= it.price
          return (
            <li key={it.key} className="flex items-center gap-3 py-2">
              <span className="w-8 text-center text-[24px]" aria-hidden="true">{it.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-ink-900">{it.name}</p>
                <p className="text-[13px] text-ink-500">{SLOT_LABEL[it.slot]}{have ? (on ? ' · 입는 중' : ' · 가지고 있음') : ` · 햇빛 ${it.price}`}</p>
              </div>
              {have ? (
                <button type="button" disabled={!!busy} onClick={() => act(it.key, on ? 'unequip' : 'equip')}
                  className={`min-h-[44px] min-w-[72px] rounded-lg px-3 text-[14px] font-bold disabled:opacity-50 ${on ? 'border border-ink-900/80 text-ink-900' : 'bg-ink-900 text-paper'}`}>
                  {busy === it.key ? '처리 중' : on ? '벗기' : '입기'}
                </button>
              ) : (
                <button type="button" disabled={!!busy || !canBuy} onClick={() => act(it.key, 'buy')}
                  aria-label={`${it.name} 햇빛 ${it.price}개로 해금`}
                  className="min-h-[44px] min-w-[72px] rounded-lg border border-ink-900 bg-brand-300 px-3 text-[14px] font-bold text-ink-900 disabled:border-ink-200 disabled:bg-ink-50 disabled:text-ink-500">
                  {busy === it.key ? '처리 중' : `☀ ${it.price}`}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
    </Section>
  )
}

/** 마지막 글자에 받침이 있으면 true (을/를 고르기) */
function hasBatchim(word: string) {
  const c = word.charCodeAt(word.length - 1)
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0
}

// ── 우리 부서 정원 ──
function GardenSection({ garden }: { garden: Garden | null }) {
  if (!garden) return <Section title="우리 부서 정원"><Loading lines={2} /></Section>
  if (!garden.department || !garden.week) {
    return (
      <Section title="우리 부서 정원">
        <p className="text-[14px] leading-relaxed text-ink-600">아직 부서가 정해지지 않았어요. 관리자가 부서를 정하면 부서 사람들과 함께 정원을 가꿀 수 있어요.</p>
      </Section>
    )
  }
  const w = garden.week
  const decor = garden.decorations ?? []
  const slots = Math.max(8, Math.ceil((decor.length + 1) / 4) * 4)
  return (
    <Section title="우리 부서 정원" action={<span className="text-[13px] font-semibold text-ink-500">{garden.department.name}</span>}>
      {w.goal !== null ? (
        <>
          <div className="flex items-baseline justify-between">
            <p className="num text-[36px] leading-none text-ink-900">
              {w.contributions}<span className="text-[18px] text-ink-400"> / {w.goal}일</span>
            </p>
            <p className="text-[14px] font-semibold text-ink-600">이번 주 {w.participants}명 참여</p>
          </div>
          <div className="mt-3"><Progress value={w.contributions} max={w.goal} label="이번 주 공동 목표 진행률" /></div>
          <p className="mt-2 text-[13px] text-ink-500">
            {w.achieved ? '이번 주 공동 목표를 달성해 정원 장식이 하나 늘었어요.' : `부서 사람들이 운동한 날이 ${w.goal - w.contributions}일 더 모이면 정원 장식이 하나 생겨요.`}
          </p>
        </>
      ) : (
        <>
          <p className="text-[14px] font-semibold text-ink-600">이번 주 {w.participants}명 참여 · 운동한 날 {w.contributions}일</p>
          <p className="mt-1 text-[13px] text-ink-500">
            {w.status === 'no_headcount' ? '부서 인원 정보가 아직 없어 공동 목표를 정하지 않았어요.' : '부서 인원 정보를 확인하고 있어 공동 목표를 잠시 정하지 않았어요.'}
          </p>
        </>
      )}

      <div className="mt-5 rounded-lg bg-brand-50 px-3 pb-3 pt-4" role="img"
        aria-label={decor.length ? `정원 장식 ${decor.length}개: ${decor.map((d) => d.name).join(', ')}` : '아직 정원 장식이 없어요'}>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: slots }, (_, i) => {
            const d = decor[i]
            return (
              <div key={i} className={`flex aspect-square items-center justify-center rounded-md text-[30px] ${d ? 'bg-paper' : 'border border-dashed border-ink-200'}`}>
                {d?.emoji ?? ''}
              </div>
            )
          })}
        </div>
      </div>
      <ul className="mt-4 space-y-1 text-[13px] leading-relaxed text-ink-500">
        <li>한 사람은 하루 1번만 기여해요(하루 여러 번 기록해도 1일).</li>
        <li>공동 목표는 이번 달 부서 인원 수만큼 운동한 날이 모이는 것이에요. 누가 참여했는지는 보이지 않아요.</li>
      </ul>
    </Section>
  )
}

// ── 피드 표시 ──
function FeedToggle({ game, onChange }: { game: Game; onChange: (v: boolean) => void }) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  async function toggle() {
    setSaving(true); setErr('')
    const r = await api('/api/me/game/profile', { method: 'PUT', body: { showInFeed: !game.showInFeed } })
    setSaving(false)
    if (r.ok) onChange(!game.showInFeed); else setErr(r.message || '저장하지 못했어요.')
  }
  return (
    <Section>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[15px] font-bold text-ink-900">피드에 내 나무·캐릭터 보이기</p>
          <p className="mt-0.5 text-[13px] text-ink-500">켜면 동료 피드의 내 이름 옆에 작게 보여요. 햇빛 수는 보이지 않아요.</p>
        </div>
        <button type="button" role="switch" aria-checked={game.showInFeed} disabled={saving} onClick={toggle}
          aria-label="피드에 내 나무와 캐릭터 보이기"
          className="flex h-[44px] w-[60px] shrink-0 items-center justify-center disabled:opacity-50">
          <span className={`relative block h-[32px] w-[56px] rounded-full border-2 border-ink-900 transition-colors ${game.showInFeed ? 'bg-brand-300' : 'bg-ink-100'}`}>
            <span className={`absolute top-[2px] h-[24px] w-[24px] rounded-full bg-ink-900 motion-safe:transition-[left] ${game.showInFeed ? 'left-[26px]' : 'left-[2px]'}`} />
          </span>
        </button>
      </div>
      {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
    </Section>
  )
}
