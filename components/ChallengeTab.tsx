'use client'

// 도전 — 목표 · 챌린지 · 배지 · 순위 를 한 화면 안에서 나눠 봅니다(메뉴를 늘리지 않음)
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useMe } from '@/lib/me'
import { Engagement, METRIC_LABEL, METRIC_UNIT, useEngagement } from '@/lib/engagement'
import { Empty, Loading, NeedLogin, Notice, PageHead, Progress, Section, Segmented, fmtMinutes } from '@/lib/ui'
import StatsTab from './StatsTab'

type Panel = 'goal' | 'challenge' | 'badge' | 'rank'

export default function ChallengeTab() {
  const [panel, setPanel] = useState<Panel>('goal')
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
      ]} />
      <div className="pt-2">
        {panel === 'goal' && <GoalPanel eng={eng} onSaved={() => setRefresh((k) => k + 1)} />}
        {panel === 'challenge' && <ChallengePanel eng={eng} onJoined={() => setRefresh((k) => k + 1)} />}
        {panel === 'badge' && <BadgePanel eng={eng} />}
        {panel === 'rank' && <RankPanel />}
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
        <ul className="mt-5 space-y-1.5 text-[13px] leading-relaxed text-ink-500">
          <li>목표는 나만 볼 수 있어요. 바꾸면 이번 주(월요일)부터 새 목표로 계산해요.</li>
          <li>운동 시간은 하루 300분까지만 인정해요. 시간이 없는 예전 기록은 횟수로만 셉니다.</li>
        </ul>
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
      <p className="border-t border-line pt-4 text-[13px] leading-relaxed text-ink-500">
        시작일 이후 기록만 인정해요. 늦게 참여해도 기간 안에 남긴 기록은 모두 들어가요.
      </p>
    </div>
  )
}

// ── 배지 ──
function BadgePanel({ eng }: { eng: EngState }) {
  return (
    <Gate eng={eng} text="본인 확인을 하면 내가 받은 배지와 다음 배지 조건을 볼 수 있어요.">
      {(d) => (
        <div>
          <Section title={`받은 배지 ${d.badges.earned.length}개`} className="border-t-0">
            {d.badges.earned.length === 0 ? (
              <Empty title="아직 받은 배지가 없어요." desc="첫 운동을 기록하면 첫 배지를 받아요." />
            ) : (
              <ul className="grid grid-cols-3 gap-x-3 gap-y-5">
                {d.badges.earned.map((b) => (
                  <li key={b.key}>
                    <Seal text={b.key.split('_')[1]} unit={b.series === 'sessions' ? '회' : b.series === 'streak' ? '일' : '주'} />
                    <p className="mt-2 text-[14px] font-bold leading-tight text-ink-900">{b.label}</p>
                    <p className="mt-0.5 text-[12px] tabular-nums text-ink-500">{b.awarded_at.slice(0, 10).replace(/-/g, '.')}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="다음 배지">
            <ul className="space-y-5">
              {d.badges.next.map((n) => (
                <li key={n.series}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <p className="text-[15px] font-bold text-ink-900">
                      {n.next ? n.next.label : `${n.seriesLabel} 배지 모두 받음`}
                      {n.next && <span className="ml-1.5 text-[13px] font-normal text-ink-500">{n.next.condition}</span>}
                    </p>
                    {n.next && <p className="shrink-0 text-[14px] font-bold tabular-nums text-ink-700">{Math.min(n.current, n.next.threshold)}/{n.next.threshold}</p>}
                  </div>
                  {n.next && <Progress value={n.current} max={n.next.threshold} label={`${n.next.label} 진행`} />}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[13px] leading-relaxed text-ink-500">
              배지는 지금 남아 있는 기록으로 판정해요. 기록을 지워 조건이 깨지면 배지도 빠져요.
            </p>
          </Section>
        </div>
      )}
    </Gate>
  )
}

/** 배지 표시: 이모지 대신 숫자를 새긴 도장 모양 */
function Seal({ text, unit }: { text: string; unit: string }) {
  return (
    <div className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-2 border-ink-900 text-ink-900" aria-hidden="true">
      <span className="num text-[24px] leading-none">{text}</span>
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
        <div className="mb-4 flex flex-wrap gap-2">
          <div role="radiogroup" aria-label="기간" className="flex gap-2">
            {(['week', 'month'] as const).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={period === p} className="chip" onClick={() => setPeriod(p)}>
                {p === 'week' ? '이번 주' : '이번 달'}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="순위 기준" className="flex gap-2">
            {(['sessions', 'minutes'] as const).map((b) => (
              <button key={b} type="button" role="radio" aria-checked={by === b} className="chip" onClick={() => setBy(b)}>
                {b === 'sessions' ? '운동 횟수' : '인정 시간'}
              </button>
            ))}
          </div>
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
          <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
            {md(r.from)}–{md(r.to)} 기록 기준. 인정 시간은 한 사람 하루 300분까지. 참여율은 인사팀이 확인한 {Number(r.yearMonth.slice(5))}월 부서 인원으로만 계산해요.
            {r.unassigned.participants > 0 && ` 부서가 정해지지 않은 직원 ${r.unassigned.participants}명의 기록은 순위에서 빠져요.`}
          </p>
        )}
      </Section>

      {/* 기존 통계(팀 기록·개인 랭킹·요일 패턴 등)는 그대로 여기에 */}
      <Section title="팀 기록">
        <StatsTab />
      </Section>
    </div>
  )
}
