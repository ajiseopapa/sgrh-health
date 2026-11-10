'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { useMe } from '@/lib/me'
import { Employee } from '@/types/database'

type Step = 'pick' | 'pin' | 'change'

function PinInput({ value, onChange, placeholder, autoFocus, onEnter }: {
  value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean; onEnter?: () => void
}) {
  return (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      placeholder={placeholder}
      className={`input-field text-center ${value ? 'text-lg tracking-[0.5em]' : 'text-sm'}`}
    />
  )
}

// 본인 확인: 이름 고르기 → PIN 6자리 → (임시 PIN이면) 내 PIN으로 바꾸기
export default function IdentityModal() {
  const { identityOpen, closeIdentity, me, mustChangePin, refresh } = useMe()
  const [step, setStep] = useState<Step>('pick')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Employee | null>(null)
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPin2, setNewPin2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!identityOpen) return
    setError(''); setPin(''); setNewPin(''); setNewPin2(''); setQuery('')
    if (me && mustChangePin) {
      // 임시 PIN으로 로그인만 해두고 창을 닫았던 경우 — "지금 PIN" 칸을 다시 보여줘야 함
      setPicked(null)
      setStep('change')
    } else {
      setStep('pick'); setPicked(null)
      supabase.from('employees').select('*').order('name').then(({ data }) => setEmployees(data ?? []))
    }
    // 창이 열릴 때 한 번만 초기화 (열린 동안 me가 바뀌어도 입력을 지우지 않음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityOpen])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return employees
      .filter((e) => e.name.toLowerCase().includes(q) || e.employee_number?.toLowerCase().includes(q))
      .slice(0, 6)
  }, [employees, query])

  if (!identityOpen) return null

  async function login() {
    if (!picked) return
    if (pin.length !== 6) { setError('PIN 6자리를 입력해주세요.'); return }
    setBusy(true); setError('')
    const r = await api<{ mustChangePin: boolean }>('/api/auth/login', { method: 'POST', body: { employeeId: picked.id, pin } })
    setBusy(false)
    if (!r.ok) { setError(r.message); setPin(''); return }
    if (r.data.mustChangePin) {
      // 방금 넣은 임시 PIN을 "지금 PIN"으로 그대로 쓰고, 새 PIN만 받습니다
      setStep('change')
      return
    }
    await refresh()
    closeIdentity(true)
  }

  async function changePin() {
    // 임시 PIN으로 막 로그인했다면 그 PIN이 "지금 PIN"
    if (pin.length !== 6) { setError('지금 PIN(임시 PIN) 6자리를 입력해주세요.'); return }
    if (newPin.length !== 6) { setError('새 PIN 6자리를 입력해주세요.'); return }
    if (newPin !== newPin2) { setError('새 PIN 두 번이 서로 달라요.'); return }
    setBusy(true); setError('')
    const r = await api('/api/auth/change-pin', { method: 'POST', body: { currentPin: pin, newPin } })
    setBusy(false)
    if (!r.ok) { setError(r.message); return }
    await refresh()
    closeIdentity(true)
  }

  const cameFromLogin = step === 'change' && picked !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-xs space-y-4 rounded-3xl bg-white p-6 shadow-raised">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-xl">
            {step === 'change' ? '🔑' : '🙋'}
          </span>
          <div>
            <h3 className="text-base font-bold text-ink-900">
              {step === 'change' ? '내 PIN 정하기' : '본인 확인'}
            </h3>
            <p className="text-xs text-ink-400">
              {step === 'pick' && '처음 한 번만 확인해요.'}
              {step === 'pin' && `${picked?.name}님의 PIN 6자리`}
              {step === 'change' && '임시 PIN을 나만 아는 번호로 바꿔주세요.'}
            </p>
          </div>
        </div>

        {step === 'pick' && (
          <div className="relative">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 또는 사번 검색"
              className="input-field"
            />
            {filtered.length > 0 && (
              <ul className="mt-1 max-h-48 overflow-auto rounded-xl bg-white py-1 shadow-raised">
                {filtered.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => { setPicked(e); setStep('pin'); setError('') }}
                      className="w-full px-3 py-2.5 text-left text-sm text-ink-800 transition hover:bg-brand-50"
                    >
                      {e.name}
                      <span className="ml-1 text-xs text-ink-300">#{e.employee_number}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 'pin' && (
          <PinInput value={pin} onChange={setPin} placeholder="••••••" autoFocus onEnter={login} />
        )}

        {step === 'change' && (
          <div className="space-y-2">
            {!cameFromLogin && (
              <PinInput value={pin} onChange={setPin} placeholder="지금 PIN" autoFocus />
            )}
            <PinInput value={newPin} onChange={setNewPin} placeholder="새 PIN" autoFocus={cameFromLogin} />
            <PinInput value={newPin2} onChange={setNewPin2} placeholder="새 PIN 한 번 더" onEnter={changePin} />
            <p className="text-[11px] text-ink-400">숫자 6자리 · 123456, 111111처럼 쉬운 번호나 사번은 안 돼요.</p>
          </div>
        )}

        {error && <p className="text-xs font-medium text-red-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => (step === 'pin' ? (setStep('pick'), setPin(''), setError('')) : closeIdentity(false))}
            className="btn-secondary"
          >
            {step === 'pin' ? '뒤로' : '닫기'}
          </button>
          {step === 'pin' && (
            <button onClick={login} disabled={busy} className="btn-primary flex-1">
              {busy ? '확인 중...' : '확인'}
            </button>
          )}
          {step === 'change' && (
            <button onClick={changePin} disabled={busy} className="btn-primary flex-1">
              {busy ? '저장 중...' : 'PIN 저장'}
            </button>
          )}
        </div>
        {step === 'pin' && (
          <p className="text-center text-[11px] text-ink-300">PIN을 모르면 관리자에게 초기화를 요청해주세요.</p>
        )}
      </div>
    </div>
  )
}
