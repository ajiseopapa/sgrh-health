'use client'

// 도전 › 정원 — 나의 정원(나무 + 장식 8칸, MyGarden.tsx) · 보유 햇빛 (나의 캐릭터는 홈의 내 프로필 창으로 옮김)
// 부서 정원은 혼자 근무하는 부서가 있어 숨김(SHOW_DEPT_GARDEN, 11-17 TK 결정). 계산·데이터는 보존
// 숫자 계산과 잔액 확인은 모두 서버가 합니다. 이 화면은 보여 주고 요청만 보냅니다.
import InfoTip from './InfoTip'
import WardrobeSection from './WardrobeSection'
import { EMOJI_KEY, ProfileEditor } from './Profile'
import MyGarden from './MyGarden'
import Guestbook from './Guestbook'
import TreeArt from './TreeArt'
export { TreeArt } // 예전 import 경로 유지(HomeTab 등)
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useMe } from '@/lib/me'
import { CHARACTERS, CharacterKey, characterOf, DEFAULT_CHARACTER, DEFAULT_LOOK, ITEMS, Placed, SHOW_DEPT_GARDEN, Equipped, SUN_DAY, SUN_GOAL, SUN_WEEK3, TREE_STAGES } from '@/lib/game'
import { Loading, NeedLogin, Notice, Progress, Section } from '@/lib/ui'

interface Game {
  today: string
  launchDate: string
  sunlight: { earned: number; spent: number; balance: number; shortfall: number }
  ledger: { type: 'earn' | 'spend'; key: string; date: string; label: string; points: number }[]
  tree: { stage: number; name: string; activeDays: number; next: { stage: number; name: string; at: number; remaining: number } | null }
  character: { owned: string[]; equipped: Equipped }
  outfitKey?: string | null
  garden?: { ready: boolean; owned: string[]; items: Placed[] }
  showInFeed: boolean
  characterKey: CharacterKey | null
  goalBasis: { kind: 'sessions' | 'minutes'; target: number; value: number } | null
}
interface Garden {
  department: { id: string; name: string } | null
  week?: { start: string; end: string; contributions: number; participants: number; goal: number | null; status: 'ok' | 'no_headcount' | 'check_needed'; achieved: boolean }
  decorations?: { week: string; emoji: string; name: string }[]
}

/** view: 'garden' = 정원 탭(정원·햇빛), 'profile' = 프로필 탭(캐릭터 꾸미기, 11-20 TK). 같은 데이터(/api/me/game)를 씀 */
export default function GardenPanel({ view = 'garden' }: { view?: 'garden' | 'profile' }) {
  const { me, mustChangePin, loaded, requireMe } = useMe()
  const ready = loaded && !!me && !mustChangePin
  const [game, setGame] = useState<Game | null>(null)
  const [garden, setGarden] = useState<Garden | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!ready) return
    const [g, d] = await Promise.all([api<Game>('/api/me/game'), SHOW_DEPT_GARDEN ? api<Garden>('/api/me/garden') : null])
    if (g.ok) setGame(g.data); else setError(g.message || '불러오지 못했어요.')
    if (d?.ok) setGarden(d.data)
  }, [ready])
  useEffect(() => { load() }, [load])

  if (loaded && !ready) return <NeedLogin text={view === 'profile' ? '본인 확인을 하면 내 캐릭터를 꾸밀 수 있어요.' : '본인 확인을 하면 나의 정원과 햇빛을 볼 수 있어요.'} onLogin={() => requireMe()} />
  if (error) return <div className="py-6"><Notice tone="error">{error}</Notice></div>
  if (!game) return <div className="py-6"><Loading /></div>

  if (view === 'profile') return (
    <div>
      {/* 내 프로필(캐릭터·한마디·이모지) — 홈의 이름을 눌러 뜨던 창과 같은 내용(11-20 TK) */}
      <section className="pb-6 pt-2">
        <ProfileEditor name={me?.name ?? ''} inline onSaved={load}
          onEmoji={(v) => { try { localStorage.setItem(EMOJI_KEY, v ?? '') } catch { /* 저장 못 해도 화면은 그대로 */ } }} />
      </section>
      <WardrobeSection game={game} onChange={setGame} />
    </div>
  )
  return (
    <div>
      <MyGarden game={game} onChange={setGame} />
      {me && <div className="lg:max-w-[680px]"><Guestbook ownerId={me.id} ownerName={me.name} mine /></div>}
      <div className="lg:max-w-[680px]"><SunSection game={game} /></div>
      {SHOW_DEPT_GARDEN && <GardenSection garden={garden} />}
    </div>
  )
}

// ── 나의 캐릭터 (픽셀 2종 중 고르기) ──
/** 픽셀 캐릭터 그림. 64×96 원본을 정수배로만 키우고 줄여 픽셀이 뭉개지지 않게 함 */
export function PixelCharacter({ charKey, scale = 2, className = '' }: { charKey: string | null; scale?: number; className?: string }) {
  const c = characterOf(charKey)
  return (
    <img src={c.src} alt={`${c.name} 캐릭터`} width={64 * scale} height={96 * scale}
      className={`shrink-0 ${className}`} style={{ width: 64 * scale, height: 96 * scale }} />
  )
}

function MyCharacterSection({ game, onChange }: { game: Game; onChange: (g: Game) => void }) {
  const [saving, setSaving] = useState<CharacterKey | null>(null)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const current = game.characterKey ?? DEFAULT_CHARACTER
  async function pick(k: CharacterKey) {
    if (saving || k === game.characterKey) return
    setSaving(k); setMsg(null)
    const r = await api('/api/me/game/profile', { method: 'PUT', body: { character: k } })
    setSaving(null)
    if (r.ok) { onChange({ ...game, characterKey: k }); setMsg({ tone: 'success', text: `${characterOf(k).name} 캐릭터로 바꿨어요.` }) }
    else setMsg({ tone: 'error', text: r.message || '저장하지 못했어요.' })
  }
  return (
    <section className="py-6">
      <p className="text-[14px] font-bold text-ink-700">나의 캐릭터</p>
      <div className="mt-3 flex items-end gap-5">
        <PixelCharacter charKey={current} scale={2} />
        <div className="min-w-0 flex-1 pb-1">
          <p className="text-[13px] leading-relaxed text-ink-500">마음에 드는 캐릭터를 고르세요. 언제든 바꿀 수 있어요.{game.characterKey ? '' : ' 아직 고르지 않아 기본 캐릭터로 보여요.'}</p>
          <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="캐릭터 고르기">
            {CHARACTERS.map((c) => {
              const on = current === c.key
              return (
                <button key={c.key} type="button" role="radio" aria-checked={on} disabled={!!saving} onClick={() => pick(c.key)}
                  className={`flex min-h-[44px] flex-col items-center gap-1 rounded-xl border-2 px-2 py-2 disabled:opacity-50 ${on ? 'border-ink-900 bg-brand-300' : 'border-line bg-sheet'}`}>
                  <PixelCharacter charKey={c.key} scale={0.5} />
                  <span className="text-[13px] font-bold text-ink-900">{on ? '✓ ' : ''}{c.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
    </section>
  )
}

// ── 나의 나무 (정원 화면 MyGarden 으로 합쳐져 지금은 안 씀. 그림 TreeArt 만 홈·정원에서 사용) ──
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

// ── 햇빛 ──
function SunSection({ game }: { game: Game }) {
  const [all, setAll] = useState(false)
  const s = game.sunlight
  const ledger = game.ledger
  const rows = all ? ledger : [] // 내역은 접어 두고, 눌렀을 때만 펼침
  return (
    <Section title="보유 햇빛">
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
        <div className="mt-3"><Notice tone="info">기록이 고쳐져 받은 햇빛이 쓴 햇빛보다 {s.shortfall}개 적어요. 이미 받은 장식은 그대로예요.</Notice></div>
      )}
      {game.goalBasis && (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-600">
          이번 주 목표 보상 기준 <span className="font-bold text-ink-900">주 {game.goalBasis.target}{game.goalBasis.kind === 'sessions' ? '회' : '분'}</span>
          {' '}· 지금 <span className="font-bold tabular-nums text-ink-900">{game.goalBasis.value}{game.goalBasis.kind === 'sessions' ? '회' : '분'}</span>
        </p>
      )}
      <InfoTip label="햇빛 받는 법" className="mt-2">
        <ul className="space-y-1">
          <li>운동한 날 +{SUN_DAY} (하루 여러 번 기록해도 1번)</li>
          <li>한 주에 3일 운동 +{SUN_WEEK3} · 주간 목표 달성 +{SUN_GOAL}</li>
          <li>{game.launchDate.slice(5).replace('-', '.')} 이후 기록부터 셉니다. 기록을 고치거나 지우면 다시 계산해요.</li>
          <li>{game.goalBasis
            ? '주중에 목표를 바꾸면 햇빛 보상은 다음 주부터 새 목표로 셉니다.'
            : `주간 목표를 정하면 달성한 주에 햇빛 ${SUN_GOAL}개를 더 받아요.`}</li>
        </ul>
      </InfoTip>
      {ledger.length > 0 && (
        <>
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {rows.map((l) => (
              <li key={l.key} className="flex items-center justify-between py-2.5 text-[14px]">
                <span className="text-ink-700"><span className="mr-2 tabular-nums text-ink-500">{l.date.slice(5).replace('-', '.')}</span>{l.label}</span>
                <span className={`font-bold tabular-nums ${l.points > 0 ? 'text-brand-600' : 'text-ink-900'}`}>{l.points > 0 ? `+${l.points}` : l.points}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setAll(!all)} className="pill-action -ml-2.5 text-ink-900 underline">
            {all ? '내역 접기' : `햇빛 내역 보기 (${ledger.length})`}
          </button>
        </>
      )}
    </Section>
  )
}

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
      <InfoTip label="정원이 자라는 법" className="mt-3">
        <ul className="space-y-1">
          <li>한 사람은 하루 1번만 기여해요(하루 여러 번 기록해도 1일).</li>
          <li>공동 목표는 이번 달 부서 인원 수만큼 운동한 날이 모이는 것이에요. 누가 참여했는지는 보이지 않아요.</li>
        </ul>
      </InfoTip>
    </Section>
  )
}

