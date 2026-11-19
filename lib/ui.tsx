'use client'

// v2.1 공통 화면 요소 — 모든 화면이 같은 간격·글꼴·상태 표시를 쓰도록 여기 한 곳에 둡니다.
import { ReactNode } from 'react'

// ── 아이콘 (선 아이콘, 24px 격자, currentColor) ──
type IconName =
  | 'home' | 'pencil' | 'flag' | 'sprout' | 'feed' | 'bell' | 'chat' | 'gear' | 'check' | 'chevron-left'
  | 'chevron-right' | 'plus' | 'close' | 'lock' | 'alert'
const PATHS: Record<IconName, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  pencil: <><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m14.5 7.5 3 3" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
  sprout: <><path d="M12 21v-9" /><path d="M12 12c0-3.5-2.5-6-7-6 0 4 2.5 6 7 6z" /><path d="M12 10c0-3 2.2-5.5 7-5.5 0 3.8-2.4 5.5-7 5.5z" /></>,
  feed: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  // 톱니바퀴(11-18 TK: 조절 막대 모양 → 톱니바퀴)
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  'chevron-left': <path d="m15 5-7 7 7 7" />,
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  alert: <><path d="M12 4 2.5 20h19z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
}
export function Icon({ name, size = 22, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {PATHS[name]}
    </svg>
  )
}

// ── 화면 제목 (탭 맨 위) ──
export function PageHead({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 pb-5 pt-2">
      <div>
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] text-ink-900">{title}</h1>
        {sub && <p className="mt-1.5 text-[14px] text-ink-500">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

// ── 영역: 위 구분선 + 이름 + (오른쪽 보조 동작) ──
export function Section({ title, action, children, className = '', id }: {
  title?: string; action?: ReactNode; children: ReactNode; className?: string; id?: string
}) {
  return (
    <section id={id} className={`border-t border-line py-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          {title && <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// ── 큰 숫자 + 단위 + 설명 ──
export function Stat({ value, unit, label, accent = false, size = 'lg' }: {
  value: ReactNode; unit?: string; label: string; accent?: boolean; size?: 'xl' | 'lg' | 'md'
}) {
  const sz = size === 'xl' ? 'text-[56px] leading-[0.95]' : size === 'lg' ? 'text-[36px] leading-none' : 'text-[24px] leading-none'
  return (
    <div>
      <p className={`num ${sz} ${accent ? 'text-brand-600' : 'text-ink-900'}`}>
        {value}
        {unit && <span className="ml-0.5 text-[15px] font-bold tracking-normal text-ink-500">{unit}</span>}
      </p>
      <p className="mt-1.5 text-[13px] text-ink-500">{label}</p>
    </div>
  )
}

// ── 진행 막대 (포인트 색 1개) ──
export function Progress({ value, max, label, tone = 'ink' }: { value: number; max: number; label: string; tone?: 'ink' | 'highlight' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}
      className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
      {/* highlight: 형광 라임은 배경과 명암 차이가 작아 진한 테두리로 경계를 보이게 함(홈 오늘 막대와 같은 방식) */}
      <div className={`h-full rounded-full transition-[width] duration-300 ${tone === 'highlight' ? 'bg-brand-300 ring-1 ring-inset ring-ink-900' : 'bg-ink-900'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── 구간 선택 (탭 안의 하위 메뉴, 기간 선택 등) ──
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex border-b border-line">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            className={`-mb-px min-h-[44px] flex-1 border-b-2 px-1 text-[15px] font-bold transition-colors ${
              on ? 'border-ink-900 text-ink-900' : 'border-transparent text-ink-400'
            }`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── 상태 표시: 불러오는 중 / 비어 있음 / 오류 / 완료 ──
export function Loading({ lines = 3, label = '불러오는 중' }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3 py-2">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-ink-100" style={{ width: `${88 - i * 18}%` }} />
      ))}
    </div>
  )
}

export function Empty({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="py-6">
      <p className="text-[15px] font-bold text-ink-800">{title}</p>
      {desc && <p className="mt-1 text-[14px] leading-relaxed text-ink-500">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Notice({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  const style = tone === 'error' ? 'text-red-700' : tone === 'success' ? 'text-brand-700' : 'text-ink-600'
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-1.5 text-[14px] font-semibold ${style}`}>
      <Icon name={tone === 'error' ? 'alert' : tone === 'success' ? 'check' : 'lock'} size={18} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  )
}

// ── 본인 확인이 필요한 영역 ──
export function NeedLogin({ text, onLogin }: { text: string; onLogin: () => void }) {
  return (
    <div className="py-4">
      <p className="text-[15px] leading-relaxed text-ink-700">{text}</p>
      <button type="button" onClick={onLogin} className="btn-secondary mt-4 w-full">본인 확인하기</button>
    </div>
  )
}

// ── 숫자 표시 ──
export function fmtMinutes(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}시간 ${m}분` : `${h}시간`
}
