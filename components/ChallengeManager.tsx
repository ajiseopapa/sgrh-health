'use client'

// 관리자: 챌린지 만들기 · 현황(참여·달성 인원) · 바로 끝내기
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useDialog } from '@/lib/dialog'
import { METRIC_LABEL, METRIC_UNIT } from '@/lib/engagement'
import { Empty, Loading, Notice } from '@/lib/ui'

type Metric = 'sessions' | 'minutes' | 'active_days'
interface Row { id: string; title: string; description: string | null; metric: Metric; target: number; start_date: string; end_date: string; status: 'upcoming' | 'active' | 'ended'; participants: number; achieved: number }
const STATUS = { active: '진행 중', upcoming: '시작 전', ended: '끝남' } as const
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
const plus = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

export default function ChallengeManager() {
  const dialog = useDialog()
  const [list, setList] = useState<Row[] | null>(null)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [metric, setMetric] = useState<Metric>('sessions')
  const [target, setTarget] = useState('10')
  const [start, setStart] = useState(today())
  const [end, setEnd] = useState(plus(today(), 13))
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  async function load() {
    const r = await api<{ challenges: Row[] }>('/api/admin/challenges')
    setList(r.ok ? r.data.challenges : [])
    if (!r.ok) setMsg({ tone: 'error', text: r.message })
  }
  useEffect(() => { load() }, [])

  async function create() {
    setMsg(null)
    const r = await api('/api/admin/challenges', { method: 'POST', body: { title, description: desc, metric, target: Number(target), startDate: start, endDate: end } })
    if (!r.ok) { setMsg({ tone: 'error', text: r.message }); return }
    setTitle(''); setDesc('')
    setMsg({ tone: 'success', text: '챌린지를 열었어요.' })
    load()
  }

  async function endNow(c: Row) {
    const ok = await dialog.confirm({ title: `'${c.title}'을 끝낼까요?`, message: '어제를 마지막 날로 바꾸고 참여를 닫아요. 기간 안 기록은 그대로 인정돼요.', confirmText: '끝내기' })
    if (!ok) return
    const r = await api(`/api/admin/challenges/${c.id}`, { method: 'PATCH', body: { endNow: true } })
    if (!r.ok) { setMsg({ tone: 'error', text: r.message }); return }
    load()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-[15px] font-bold text-ink-900">챌린지 열기</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="이름 (예: 11월 걷기 2주)" className="input-field" aria-label="챌린지 이름" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} placeholder="한 줄 설명 (선택)" className="input-field" aria-label="설명" />
        <div role="radiogroup" aria-label="목표 기준" className="flex flex-wrap gap-2">
          {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={metric === m} className="chip" onClick={() => setMetric(m)}>{METRIC_LABEL[m]}</button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-[13px] text-ink-600">목표({METRIC_UNIT[metric]})
            <input type="number" inputMode="numeric" min={1} value={target} onChange={(e) => setTarget(e.target.value)} className="input-field mt-1 py-2 text-right tabular-nums" />
          </label>
          <label className="text-[13px] text-ink-600">시작
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input-field mt-1 px-2 py-2 text-[14px]" />
          </label>
          <label className="text-[13px] text-ink-600">끝
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input-field mt-1 px-2 py-2 text-[14px]" />
          </label>
        </div>
        <button onClick={create} disabled={!title.trim()} className="btn-primary">챌린지 열기</button>
        <p className="text-[13px] leading-relaxed text-ink-500">시작일 전 기록은 인정하지 않아요. 참여자가 생기면 기준·목표·시작일은 바꿀 수 없어요.</p>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>

      <div>
        <p className="mb-2 text-[15px] font-bold text-ink-900">챌린지 현황</p>
        {!list ? <Loading /> : list.length === 0 ? <Empty title="연 챌린지가 없어요." /> : (
          <ul className="divide-y divide-line border-y border-line">
            {list.map((c) => (
              <li key={c.id} className="py-3.5">
                <p className="text-[13px] font-semibold tabular-nums text-ink-500">{STATUS[c.status]} · {c.start_date} ~ {c.end_date}</p>
                <p className="mt-0.5 text-[15px] font-bold text-ink-900">{c.title}</p>
                <p className="mt-0.5 text-[13px] text-ink-600">
                  {METRIC_LABEL[c.metric]} {c.target}{METRIC_UNIT[c.metric]} · 참여 {c.participants}명 · 달성 {c.achieved}명
                </p>
                {c.status !== 'ended' && (
                  <button onClick={() => endNow(c)} className="pill-action -ml-2.5 mt-1 text-ink-700">지금 끝내기</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
