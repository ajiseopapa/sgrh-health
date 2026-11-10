'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Employee } from '@/types/database'
import PinIssueResult, { IssuedPin } from './PinIssueResult'

type PinStatus = 'none' | 'temp' | 'set' | 'locked'
type AdminEmployee = Employee & { pin_status: PinStatus }

const PIN_BADGE: Record<PinStatus, { label: string; cls: string }> = {
  none: { label: 'PIN 없음', cls: 'bg-red-50 text-red-500' },
  temp: { label: '임시 PIN', cls: 'bg-amber-50 text-amber-600' },
  set: { label: 'PIN 등록', cls: 'bg-brand-50 text-brand-700' },
  locked: { label: '잠김', cls: 'bg-red-100 text-red-600' },
}
import { PALETTE, getEmployeeColor } from '@/lib/colors'

export default function EmployeeManager() {
  const [list, setList] = useState<AdminEmployee[]>([])
  const [issued, setIssued] = useState<IssuedPin[] | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [empNo, setEmpNo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmpNo, setEditEmpNo] = useState('')
  const [editColor, setEditColor] = useState<string | null>(null)

  async function fetchList() {
    setLoading(true)
    const r = await api<{ employees: AdminEmployee[] }>('/api/admin/employees')
    if (r.ok) setList(r.data.employees ?? [])
    else setError(r.message)
    setLoading(false)
  }

  useEffect(() => {
    fetchList()
  }, [])

  async function handleAdd() {
    if (!name.trim()) {
      setError('이름을 입력해주세요.')
      return
    }
    if (!empNo.trim()) {
      setError('사번을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError('')
    const r = await api('/api/admin/employees', {
      method: 'POST',
      body: { name: name.trim(), employeeNumber: empNo.trim() },
    })
    setSubmitting(false)
    if (!r.ok) { setError(r.message); return }
    setName('')
    setEmpNo('')
    fetchList()
  }

  function startEdit(emp: Employee) {
    setEditingId(emp.id)
    setEditName(emp.name)
    setEditEmpNo(emp.employee_number ?? '')
    setEditColor(emp.color ?? null)
    setError('')
  }

  async function handleUpdate() {
    if (!editingId) return
    if (!editName.trim()) {
      setError('이름을 입력해주세요.')
      return
    }
    if (!editEmpNo.trim()) {
      setError('사번을 입력해주세요.')
      return
    }
    const r = await api(`/api/admin/employees/${editingId}`, {
      method: 'PATCH',
      body: { name: editName.trim(), employeeNumber: editEmpNo.trim(), color: editColor },
    })
    if (!r.ok) { setError(r.message); return }
    setEditingId(null)
    setError('')
    fetchList()
  }

  async function handleDelete(id: string, empName: string) {
    const ok = window.confirm(`'${empName}'님을 삭제하면 관련 운동 기록도 함께 삭제돼요.\n계속할까요?`)
    if (!ok) return
    const r = await api(`/api/admin/employees/${id}`, { method: 'DELETE' })
    if (!r.ok) { setError(r.message); return }
    fetchList()
  }

  async function issuePins(mode: 'missing' | 'reset', employeeId?: string, empName?: string) {
    const msg = mode === 'missing'
      ? 'PIN이 없는 직원 전원에게 임시 PIN을 발급할까요?\n발급된 번호는 이번 한 번만 화면에 보여요.'
      : `'${empName}'님의 PIN을 초기화할까요?\n그 직원의 모든 기기에서 로그인이 풀리고, 새 임시 PIN이 발급돼요.`
    if (!window.confirm(msg)) return
    setIssuing(true); setError('')
    const r = await api<{ issued: IssuedPin[] }>('/api/admin/pins', { method: 'POST', body: { mode, employeeId } })
    setIssuing(false)
    if (!r.ok) { setError(r.message); return }
    if (!r.data.issued?.length) { setError('PIN이 없는 직원이 없어요.'); return }
    setIssued(r.data.issued)
    fetchList()
  }

  if (issued) {
    return <PinIssueResult issued={issued} onClose={() => setIssued(null)} />
  }

  const missingCount = list.filter((e) => e.pin_status === 'none').length

  return (
    <div className="space-y-4">
      <div className="card space-y-2.5">
        <p className="text-sm font-semibold text-ink-700">직원 등록</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className="input-field"
        />
        <input
          value={empNo}
          onChange={(e) => setEmpNo(e.target.value)}
          placeholder="사번"
          required
          className="input-field"
        />
        <button onClick={handleAdd} disabled={submitting} className="btn-primary">
          {submitting ? '등록 중...' : '등록'}
        </button>
        {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      </div>

      <div className="card space-y-2">
        <p className="text-sm font-semibold text-ink-700">본인 확인 PIN</p>
        <p className="text-xs text-ink-400">
          PIN 없음 {missingCount}명 · 임시 PIN {list.filter((e) => e.pin_status === 'temp').length}명 ·
          등록 {list.filter((e) => e.pin_status === 'set').length}명
        </p>
        <button
          onClick={() => issuePins('missing')}
          disabled={issuing || missingCount === 0}
          className="btn-primary disabled:opacity-50"
        >
          {issuing ? '발급 중...' : `PIN 없는 직원 ${missingCount}명 임시 PIN 발급`}
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          직원 목록 ({list.length}명)
        </p>
        {loading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-ink-100" />
        ) : list.length === 0 ? (
          <div className="card text-center text-sm text-ink-400">등록된 직원이 없어요.</div>
        ) : (
          <ul className="card divide-y divide-ink-100 p-0">
            {list.map((emp) => (
              <li key={emp.id} className="px-4 py-3">
                {editingId === emp.id ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="이름"
                      className="input-field py-1.5"
                    />
                    <input
                      value={editEmpNo}
                      onChange={(e) => setEditEmpNo(e.target.value)}
                      placeholder="사번"
                      className="input-field py-1.5"
                    />
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-ink-400">색상</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditColor(c)}
                            aria-label={`색상 ${c} 선택`}
                            className={`h-7 w-7 rounded-full transition ${
                              editColor === c ? 'ring-2 ring-offset-2 ring-ink-800' : ''
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <label
                          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-ink-300 text-xs text-ink-400"
                          title="직접 선택"
                        >
                          🎨
                          <input
                            type="color"
                            value={editColor ?? '#1F9B7D'}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditColor(null)}
                          className={`pill-action ${
                            editColor === null ? 'bg-ink-800 text-white' : 'bg-ink-100 text-ink-500'
                          }`}
                        >
                          자동
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-0.5">
                      <button onClick={handleUpdate} className="btn-primary flex-1 py-1.5 text-xs">
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="btn-secondary py-1.5 text-xs"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: getEmployeeColor(emp) }}
                        title={emp.color ? '커스텀 색상' : '자동 색상'}
                      />
                      <span className="font-medium text-ink-800">{emp.name}</span>
                      <span className="text-xs text-ink-300">#{emp.employee_number}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PIN_BADGE[emp.pin_status].cls}`}>
                        {PIN_BADGE[emp.pin_status].label}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(emp)}
                        className="pill-action bg-brand-50 text-brand-700"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => issuePins('reset', emp.id, emp.name)}
                        disabled={issuing}
                        className="pill-action bg-ink-100 text-ink-600"
                      >
                        PIN 초기화
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id, emp.name)}
                        className="pill-action bg-red-50 text-red-500"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
