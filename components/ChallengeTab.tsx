'use client'

// 도전 — 목표 · 챌린지 · 배지 · 순위 · 정원 을 한 화면 안에서 나눠 봅니다(메뉴를 늘리지 않음)
import InfoTip from './InfoTip'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useMe } from '@/lib/me'
import { Engagement, METRIC_LABEL, METRIC_UNIT, useEngagement } from '@/lib/engagement'
import { Empty, Icon, Loading, NeedLogin, Notice, PageHead, Progress, Section, Segmented, fmtMinutes } from '@/lib/ui'
import { BADGES, BadgeDef, badgeSrc, SERIES_LABEL, SERIES_UNIT } from '@/lib/badges'
import StatsTab from './StatsTab'
import GardenPanel from './GardenPanel'

export type Panel = 'goal' | 'challenge' | 'badge' | 'rank' | 'garden'

export default function ChallengeTab({ initialPanel = 'goal' }: { initialPanel?: Panel }) {
  const [panel, setPanel] = useState<Panel>(initialPanel)
  const [refresh, setRefresh] = useState(0)
  const eng = useEngagement(refresh)

  return (
    <div>
      <PageHead title="도전" />
      <Segmented label="도전 메뉴" value={panel} onChange={setPanel} options={[
        { value: 'goal', label: '목표' },
        { value: 'challenge', label: '챌린지' },
        { value: 'badge', label: '배지' },
        { value: 'rank', label: '순위' },
        { value: 'garden', label: '정원' },
      ]} />
      {/* PC: 순위(통계)와 정원(정원 + 장식 목록 나란히)은 넓게, 나머지는 읽기 좋은 폭 */}
      <div className={`pt-2 ${panel === 'rank' || panel === 'garden' ? '' : 'lg:max-w-[680px]'}`}>
        {panel === 'goal' && <GoalPanel eng={eng} onSaved={() => setRefresh((k) => k + 1)} />}
        {panel === 'challenge' && <ChallengePanel eng={eng} onJoined={() => setRefresh((k) => k + 1)} />}
        {panel === 'badge' && <BadgePanel eng={eng} />}
        {panel === 'rank' && <RankPanel />}
        {panel === 'garden' && <GardenPanel />}
      </div>
    </div>
  )
}

type EngState = ReturnType<typeof useEngagement>

function Gate({ eng, children, text }: { eng: EngState; children: (d: Engagement) => React.ReactNode; text: string }) {
  const { requireMe } = useMe()
  if (eng.needLogin) return <NeedLogin text={text} onLogin={() => requireMe()} />
  if (eng.loading && !eng.data) return <div className="py-6"><Loading /></div>
  if (eng.error) return <div className="py-6"><Notice tone="error">{eng.error}</Notice></div>
  if (!eng.data) return null
  return <>{children(eng.data)}</>
}

// ── 목표 ──
const SESSION_CHOICES = [2, 3, 4, 5]
const MINUTE_CHOICES = [60, 90, 150, 210]

function GoalPanel({ eng, onSaved }: { eng: EngState; onSaved: () => void }) {
  return (
    <Gate eng={eng} text="본인 확인을 하면 나만 보는 주간 목표를 정할 수 있어요.">
      {(d) => <GoalBody d={d} onSaved={onSaved} />}
    </Gate>
  )
}

function GoalBody({ d, onSaved }: { d: Engagement; onSaved: () => void }) {
  const [kind, setKind] = useState<'sessions' | 'minutes'>(d.goal?.kind ?? 'sessions')
  const [target, setTarget] = useState(String(d.goal?.target ?? 3))
  const [editing, setEditing] = useState(!d.goal)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  async function save() {
    setSaving(true); setMsg(null)
    const r = await api('/api/me/goal', { method: 'PUT', body: { kind, target: Number(target) } })
    setSaving(false)
    if (!r.ok) { setMsg({ tone: 'error', text: r.message || '저장하지 못했어요.' }); return }
    setMsg({ tone: 'success', text: '이번 주부터 이 목표로 계산해요.' })
    setEditing(false)
    onSaved()
  }

  const g = d.goal
  const unit = g?.kind === 'sessions' ? '회' : '분'
  return (
    <div>
      <div className="py-6">
        {g ? (
          <>
            <p className="text-[14px] font-bold text-ink-700">이번 주 목표</p>
            <p className="num mt-2 text-[56px] leading-[0.95] text-ink-900">
              <span className={g.value >= g.target ? 'text-brand-600' : ''}>{g.value}</span>
              <span className="text-[24px] text-ink-400"> / {g.target}{unit}</span>
            </p>
            <div className="mt-4"><Progress value={g.value} max={g.target} label="이번 주 목표 달성률" /></div>
            <p className="mt-3 text-[14px] text-ink-600">
              {g.value >= g.target ? '이번 주 목표를 달성했어요.' : `${g.target - g.value}${unit} 남았어요.`}
              {' '}<span className="text-ink-500">{d.week.start.slice(5).replace('-', '.')}(월)–{d.week.end.slice(5).replace('-', '.')}(일)</span>
            </p>
          </>
        ) : (
          <Empty title="아직 주간 목표가 없어요." desc="운동 횟수나 운동 시간 중 하나를 정하면, 이번 주 기록으로 달성률을 보여드려요." />
        )}
      </div>

      <Section title={g ? '목표 바꾸기' : '목표 정하기'}
        action={g && !editing && <button type="button" onClick={() => setEditing(true)} className="pill-action -mr-2.5 text-ink-900 underline">바꾸기</button>}>
        {editing ? (
          <div className="space-y-5">
            <div role="radiogroup" aria-label="목표 기준" className="flex gap-2">
              {(['sessions', 'minutes'] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} className="chip flex-1 justify-center"
                  onClick={() => { setKind(k); setTarget(k === 'sessions' ? '3' : '150') }}>
                  {k === 'sessions' ? '운동 횟수' : '운동 시간'}
                </button>
              ))}
            </div>
            <div>
              <p className="mb-2.5 text-[14px] font-bold text-ink-900">일주일에</p>
              <div className="flex flex-wrap items-center gap-2">
                {(kind === 'sessions' ? SESSION_CHOICES : MINUTE_CHOICES).map((n) => (
                  <button key={n} type="button" className="chip tabular-nums" aria-pressed={target === String(n)} onClick={() => setTarget(String(n))}>
                    {n}{kind === 'sessions' ? '회' : '분'}
                  </button>
                ))}
                <label className="relative w-24">
                  <span className="sr-only">직접 입력</span>
                  <input type="number" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)}
                    className="input-field py-2 pr-8 text-right tabular-nums" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-ink-500">{kind === 'sessions' ? '회' : '분'}</span>
                </label>
              </div>
            </div>
            <button type="button" onClick={save} disabled={saving} className="btn-primary">{saving ? '저장하는 중' : '목표 저장'}</button>
          </div>
        ) : null}
        {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
        <InfoTip label="목표 계산 기준" className="mt-4">
          <ul className="space-y-1">
            <li>목표는 나만 볼 수 있어요. 바꾸면 이번 주(월요일)부터 새 목표로 계산해요.</li>
            <li>운동 시간은 하루 300분까지만 인정해요. 시간이 없는 예전 기록은 횟수로만 셉니다.</li>
          </ul>
        </InfoTip>
      </Section>
    </div>
  )
}

// ── 챌린지 ──
interface PublicChallenge {
  id: string; title: string; description: string | null; metric: 'sessions' | 'minutes' | 'active_days'; target: number
  start_date: string; end_date: string; status: 'upcoming' | 'active' | 'ended'; participants: number
  joined?: boolean; progress?: number | null
}
const STATUS_LABEL = { active: '진행 중', upcoming: '시작 전', ended: '끝남' } as const
const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`

function ChallengePanel({ eng, onJoined }: { eng: EngState; onJoined: () => void }) {
  const { requireMe } = useMe()
  const [pub, setPub] = useState<PublicChallenge[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (eng.needLogin) api<{ challenges: PublicChallenge[] }>('/api/challenges').then((r) => setPub(r.ok ? r.data.challenges : []))
  }, [eng.needLogin])

  const list: PublicChallenge[] | null = eng.data ? eng.data.challenges : eng.needLogin ? pub : null

  async function join(id: string) {
    if (eng.needLogin) { requireMe(); return }
    setBusy(id); setMsg('')
    const r = await api(`/api/challenges/${id}/join`, { method: 'POST' })
    setBusy(null)
    if (!r.ok) { setMsg(r.message || '참여하지 못했어요.'); return }
    onJoined()
  }

  if (!list) return <div className="py-6"><Loading /></div>
  const order = { active: 0, upcoming: 1, ended: 2 }
  const sorted = [...list].sort((a, b) => order[a.status] - order[b.status] || a.start_date.localeCompare(b.start_date))
  if (sorted.length === 0) return <Empty title="지금 열린 챌린지가 없어요." desc="관리자가 챌린지를 열면 여기에 나타나요." />

  return (
    <div>
      {msg && <div className="pt-4"><Notice tone="error">{msg}</Notice></div>}
      <ul className="divide-y divide-line">
        {sorted.map((c) => {
          const unit = METRIC_UNIT[c.metric]
          const done = c.progress != null && c.progress >= c.target
          return (
            <li key={c.id} className={`py-6 ${c.status === 'ended' ? 'opacity-70' : ''}`}>
              <p className="text-[13px] font-semibold tabular-nums text-ink-500">
                <span className={c.status === 'active' ? 'text-brand-700' : ''}>{STATUS_LABEL[c.status]}</span> · {md(c.start_date)}–{md(c.end_date)} · {c.participants}명 참여
              </p>
              <h3 className="mt-1.5 text-[20px] font-extrabold leading-snug tracking-[-0.02em] text-ink-900">{c.title}</h3>
              <p className="mt-1 text-[14px] text-ink-600">
                {METRIC_LABEL[c.metric]} {c.metric === 'minutes' ? fmtMinutes(c.target) : `${c.target}${unit}`}
                {c.description ? ` · ${c.description}` : ''}
              </p>
              {c.joined ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="text-[14px] font-bold text-ink-900">
                      {done ? '달성' : c.status === 'upcoming' ? '시작하면 계산돼요' : '내 진행'}
                    </p>
                    <p className="num text-[18px] text-ink-900">
                      <span className={done ? 'text-brand-600' : ''}>{c.progress ?? 0}</span>
                      <span className="text-[14px] text-ink-500"> / {c.target}{unit}</span>
                    </p>
                  </div>
                  <Progress value={c.progress ?? 0} max={c.target} label={`${c.title} 진행률`} />
                </div>
              ) : c.status !== 'ended' ? (
                <button type="button" onClick={() => join(c.id)} disabled={busy === c.id} className="btn-secondary mt-4 w-full">
                  {busy === c.id ? '참여하는 중' : '참여하기'}
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
      <InfoTip label="챌린지 인정 기준" className="border-t border-line pt-3">
        시작일 이후 기록만 인정해요. 늦게 참여해도 기간 안에 남긴 기록은 모두 들어가요.
      </InfoTip>
    </div>
  )
}

// ── 배지 ──
function BadgePanel({ eng }: { eng: EngState }) {
  return (
    <Gate eng={eng} text="본인 확인을 하면 내가 받은 배지와 다음 배지 조건을 볼 수 있어요.">
      {(d) => <BadgeBody d={d} />}
    </Gate>
  )
}

type BadgeView = BadgeDef & { earnedAt: string | null; current: number }

function BadgeBody({ d }: { d: Engagement }) {
  const [open, setOpen] = useState<BadgeView | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null) // 시트를 닫으면 누른 배지로 초점을 돌려줌
  const earnedAt = new Map(d.badges.earned.map((b) => [b.key, b.awarded_at]))
  const current = Object.fromEntries(d.badges.next.map((n) => [n.series, n.current])) as Record<BadgeDef['series'], number>
  const all: BadgeView[] = BADGES.map((b) => ({ ...b, earnedAt: earnedAt.get(b.key) ?? null, current: current[b.series] ?? 0 }))
  const list = [...all.filter((b) => b.earnedAt), ...all.filter((b) => !b.earnedAt)] // 받은 배지 먼저
  const got = all.filter((b) => b.earnedAt).length
  return (
    <div>
      <Section title="나의 배지" className="border-t-0" action={<span className="text-[13px] font-bold tabular-nums text-ink-700">획득한 배지 {got} / {BADGES.length}</span>}>
        <ul className="grid grid-cols-3 gap-x-2 gap-y-4">
          {list.map((b) => (
            <li key={b.key}>
              <button type="button" onClick={(e) => { trigger.current = e.currentTarget; setOpen(b) }}
                aria-label={`${b.label} — ${b.earnedAt ? `${fmtDate(b.earnedAt)} 획득` : `잠김, ${b.condition}`}. 자세히 보기`}
                className="flex w-full flex-col items-center rounded-xl px-1 py-2 text-center active:bg-ink-900/5">
                <BadgeArt b={b} />
                <span className="mt-1.5 break-keep text-[14px] font-bold leading-tight text-ink-900">{b.label}</span>
                {b.earnedAt ? (
                  <span className="mt-0.5 text-[12px] tabular-nums text-ink-500">{fmtDate(b.earnedAt)}</span>
                ) : (
                  <span className="mt-0.5 inline-flex items-center gap-0.5 text-[12px] font-semibold text-ink-500">
                    <Icon name="lock" size={12} /> 잠김 · {Math.min(b.current, b.threshold)}/{b.threshold}{SERIES_UNIT[b.series]}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="다음 배지">
        <ul className="space-y-5">
          {d.badges.next.map((n) => {
            const nb = n.next ? BADGES.find((b) => b.key === n.next!.key) : null
            return (
              <li key={n.series} className="flex items-center gap-3">
                {nb && <BadgeArt b={{ ...nb, earnedAt: null, current: n.current }} size={48} />}
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <p className="text-[15px] font-bold text-ink-900">
                      {n.next ? n.next.label : `${n.seriesLabel} 배지 모두 받음`}
                      {n.next && <span className="ml-1.5 text-[13px] font-normal text-ink-500">{n.next.condition}</span>}
                    </p>
                    {n.next && <p className="shrink-0 text-[14px] font-bold tabular-nums text-ink-700">{Math.min(n.current, n.next.threshold)}/{n.next.threshold}</p>}
                  </div>
                  {n.next && <Progress value={n.current} max={n.next.threshold} label={`${n.next.label} 진행`} />}
                </div>
              </li>
            )
          })}
        </ul>
        <InfoTip label="배지 판정 기준" className="mt-4">
          배지는 지금 남아 있는 기록으로 판정해요. 기록을 지워 조건이 깨지면 배지도 빠져요.
        </InfoTip>
      </Section>
      {open && <BadgeSheet b={open} onClose={() => { setOpen(null); trigger.current?.focus() }} />}
    </div>
  )
}

const fmtDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '.')

/** 배지 그림. 받은 배지는 원본 색, 못 받은 배지는 흑백·반투명(+ 글자로 '잠김' 표시는 바깥에서). 그림을 못 불러오면 숫자 도장 */
function BadgeArt({ b, size = 64 }: { b: BadgeView; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <div style={{ opacity: b.earnedAt ? 1 : 0.45 }}><Seal text={String(b.threshold)} unit={SERIES_UNIT[b.series]} size={size} /></div>
  return (
    <img src={badgeSrc(b.key)} alt="" aria-hidden="true" width={size} height={size} onError={() => setBroken(true)}
      style={{ width: size, height: size, filter: b.earnedAt ? undefined : 'grayscale(1)', opacity: b.earnedAt ? 1 : 0.45 }} />
  )
}

/** 배지 자세히(가벼운 바텀시트) — 달성 조건과 획득일 */
function BadgeSheet({ b, onClose }: { b: BadgeView; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/45 lg:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="badge-sheet-title" className="w-full max-w-md rounded-t-2xl bg-paper lg:rounded-2xl px-5 pb-8 pt-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} aria-label="닫기" autoFocus className="-mr-2 flex h-11 w-11 items-center justify-center text-[24px] leading-none text-ink-500">×</button>
        </div>
        <div className="flex flex-col items-center text-center">
          <BadgeArt b={b} size={128} />
          <h2 id="badge-sheet-title" className="mt-3 text-[20px] font-extrabold text-ink-900">{b.label}</h2>
          <p className="mt-1 text-[14px] text-ink-600">{SERIES_LABEL[b.series]} · {b.condition}</p>
          {b.earnedAt ? (
            <p className="mt-3 text-[15px] font-bold text-brand-600">{fmtDate(b.earnedAt)}에 받았어요</p>
          ) : (
            <div className="mt-3 w-full max-w-[260px]">
              <p className="mb-2 inline-flex items-center gap-1 text-[14px] font-bold text-ink-700"><Icon name="lock" size={14} /> 아직 받지 않았어요 · {Math.min(b.current, b.threshold)}/{b.threshold}{SERIES_UNIT[b.series]}</p>
              <Progress value={b.current} max={b.threshold} label={`${b.label} 진행`} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** 배지 그림을 못 불러올 때: 숫자를 새긴 도장 모양 */
function Seal({ text, unit, size = 72 }: { text: string; unit: string; size?: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-full border-2 border-ink-900 text-ink-900" style={{ width: size, height: size }} aria-hidden="true">
      <span className="num text-[22px] leading-none">{text}</span>
      <span className="mt-0.5 text-[11px] font-bold">{unit}</span>
    </div>
  )
}

// ── 순위 ──
interface DeptRow { id: string; name: string; participants: number; sessions: number; minutes: number; headcount: number | null; rate: number | null; rateStatus: 'ok' | 'no_headcount' | 'check_needed' }
interface Ranking { period: 'week' | 'month'; from: string; to: string; yearMonth: string; departments: DeptRow[]; bySessions: string[]; byMinutes: string[]; unassigned: { participants: number; sessions: number; minutes: number } }

function RankPanel() {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [by, setBy] = useState<'sessions' | 'minutes'>('sessions')
  const [r, setR] = useState<Ranking | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    setR(null); setErr('')
    api<Ranking>(`/api/departments/ranking?period=${period}`).then((x) => (x.ok ? setR(x.data) : setErr(x.message || '순위를 불러오지 못했어요.')))
  }, [period])

  const rows = r ? (by === 'sessions' ? r.bySessions : r.byMinutes).map((id) => r.departments.find((d) => d.id === id)!).filter(Boolean) : []

  return (
    <div>
      <Section title="부서 순위" className="border-t-0">
        <div className="mb-4 grid grid-cols-2 gap-3">
          {([
            { label: '기간', value: period, set: (v: string) => setPeriod(v as 'week' | 'month'), opts: [['week', '이번 주'], ['month', '이번 달']] },
            { label: '순위 기준', value: by, set: (v: string) => setBy(v as 'sessions' | 'minutes'), opts: [['sessions', '운동 횟수'], ['minutes', '인정 시간']] },
          ] as const).map((g) => (
            <div key={g.label} className="min-w-0">
              <p className="mb-1.5 text-[12px] font-semibold text-ink-500">{g.label}</p>
              <div role="radiogroup" aria-label={g.label} className="flex rounded-xl bg-ink-50 p-1">
                {g.opts.map(([v, text]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={g.value === v}
                    onClick={() => g.set(v)}
                    className={`min-h-[40px] flex-1 rounded-lg px-2 text-[14px] font-bold transition-colors ${g.value === v ? 'bg-brand-300 text-ink-900 shadow-sm' : 'text-ink-500'}`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {err ? <Notice tone="error">{err}</Notice> : !r ? <Loading /> : rows.length === 0 ? (
          <Empty title="아직 등록된 부서가 없어요." desc="관리자가 부서와 소속 직원을 등록하면 부서별 순위가 나와요." />
        ) : (
          <ol className="divide-y divide-line border-y border-line">
            {rows.map((d, i) => (
              <li key={d.id} className="flex items-center gap-4 py-3.5">
                <span className={`num w-7 text-[22px] ${i === 0 && (by === 'sessions' ? d.sessions : d.minutes) > 0 ? 'text-brand-600' : 'text-ink-400'}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold text-ink-900">{d.name}</p>
                  <p className="mt-0.5 text-[13px] text-ink-500">
                    {d.participants}명 참여 · {d.rateStatus === 'ok' && d.rate !== null
                      ? `참여율 ${Math.round(d.rate * 100)}% (인사팀 ${d.headcount}명 기준)`
                      : d.rateStatus === 'check_needed' ? '참여율: 인원 확인 필요' : '참여율: 인원 정보 없음'}
                  </p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="num text-[20px] text-ink-900">{by === 'sessions' ? d.sessions : d.minutes.toLocaleString()}</span>
                  <span className="ml-0.5 text-[13px] font-bold text-ink-500">{by === 'sessions' ? '회' : '분'}</span>
                </p>
              </li>
            ))}
          </ol>
        )}
        {r && (
          <InfoTip label="순위 계산 기준" className="mt-3">
            {md(r.from)}–{md(r.to)} 기록 기준. 인정 시간은 한 사람 하루 300분까지. 참여율은 인사팀이 확인한 {Number(r.yearMonth.slice(5))}월 부서 인원으로만 계산해요.
            {r.unassigned.participants > 0 && ` 부서가 정해지지 않은 직원 ${r.unassigned.participants}명의 기록은 순위에서 빠져요.`}
          </InfoTip>
        )}
      </Section>

      {/* 기존 통계(팀 기록·개인 랭킹·요일 패턴 등)는 그대로 여기에 */}
      <Section title="팀 기록">
        <StatsTab />
      </Section>
    </div>
  )
}
