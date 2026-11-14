'use client'
import { useId, useState } from 'react'

// ⓘ 버튼 — 누르면 설명이 펼쳐지고, 다시 누르면 접힌다. 설명 문구를 화면에 늘 깔아두지 않기 위한 것.
export default function InfoTip({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="-ml-1 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-1 text-[13px] font-semibold text-ink-500"
      >
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden className="shrink-0">
          <circle cx={9} cy={9} r={7.6} fill={open ? '#D8F36A' : 'none'} stroke="#5E6A64" strokeWidth={1.4} />
          <circle cx={9} cy={5.6} r={1} fill="#202D29" />
          <rect x={8.2} y={7.8} width={1.6} height={5.2} rx={0.8} fill="#202D29" />
        </svg>
        {label}
      </button>
      {open && (
        <div id={id} className="mt-1 rounded-xl bg-ink-50 p-3 text-[13px] leading-relaxed text-ink-600">
          {children}
        </div>
      )}
    </div>
  )
}
