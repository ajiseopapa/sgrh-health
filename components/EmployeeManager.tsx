'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useDialog } from '@/lib/dialog'
import { Employee } from '@/types/database'
import PinIssueResult, { IssuedPin } from './PinIssueResult'
import BulkEmployeeAdd from './BulkEmployeeAdd'

type PinStatus = 'none' | 'temp' | 'set' | 'locked'
type AdminEmployee = Employee & {
  pin_status: PinStatus
  left_at?: string | null
  department: { id: string; name: string | null; since: string } | null
}
interface Dept { id: string; name: string }

const PIN_BADGE: Record<PinStatus, { label: string; cls: string }> = {
  none: { label: 'PIN 없음', cls: 'text-red-700' },
  temp: { label: '임시 PIN', cls: 'text-ink-700' },
  set: { label: 'PIN 등록', cls: 'text-ink-500' },
  locked: { label: '잠김', cls: 'text-red-700' },
}
const seoulToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
import { PALETTE, getEmployeeColor } from '@/lib/colors'

export default function EmployeeManager() {
  const dialog = useDialog()
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

  // v2.1 부서 배정 · 퇴사 처리
  const [depts, setDepts] = useState<Dept[]>([])
  const [mode, setMode] = useState<{ id: string; kind: 'dept' | 'retire' } | null>(null)
  const [deptChoice, setDeptChoice] = useState('')
  const [actDate, setActDate] = useState(seoulToday())

  async function fetchList() {
    setLoading(true)
    const r = await api<{ employees: AdminEmployee[] }>('/api/admin/employees')
    if (r.ok) setList(r.data.employees ?? [])
    else setError(r.message)
    setLoading(false)
  }

  useEffect(() => {
    fetchList()
    api<{ departments: Dept[] }>('/api/admin/departments').then((r) => r.ok && setDepts(r.data.departments ?? []))
  }, [])

  function openMode(emp: AdminEmployee, kind: 'dept' | 'retire') {
    setMode({ id: emp.id, kind })
    setDeptChoice(emp.department?.id ?? '')
    setActDate(seoulToday())
    setError('')
  }

  async function saveDept(emp: AdminEmployee) {
    const r = await api(`/api/admin/employees/${emp.id}/department`, { method: 'POST', body: { departmentId: deptChoice || null, startDate: actDate } })
    if (!r.ok) { setError(r.message); return }
    setMode(null)
    fetchList()
  }

  async function saveRetire(emp: AdminEmployee, cancel = false) {
    if (!cancel) {
      const ok = await dialog.confirm({
        title: `${emp.name}님을 퇴사 처리할까요?`,
        message: `${actDate}까지 근무로 기록하고, 다음 날부터 로그인할 수 없어요.\n운동 기록과 부서 이력은 그대로 남아요.`,
        confirmText: '퇴사 처리',
      })
      if (!ok) return
    }
    const r = await api(`/api/admin/employees/${emp.id}/retire`, { method: 'POST', body: { leftAt: cancel ? null : actDate } })
    if (!r.ok) { setError(r.message); return }
    setMode(null)
    fetchList()
  }

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
    const ok = await dialog.confirm({
      title: `${empName}님을 삭제할까요?`,
      message: '잘못 등록한 직원만 삭제하세요. 운동 기록도 모두 함께 지워지고 되돌릴 수 없어요.\n퇴사한 직원은 \'퇴사\'로 처리하면 기록이 남아요.',
      tone: 'danger',
    })
    if (!ok) return
    const r = await api(`/api/admin/employees/${id}`, { method: 'DELETE' })
    if (!r.ok) { setError(r.message); return }
    fetchList()
  }

  async function issuePins(mode: 'missing' | 'reset', employeeId?: string, empName?: string) {
    const ok = await dialog.confirm(
      mode === 'missing'
        ? {
            title: '임시 PIN을 발급할까요?',
            message: 'PIN이 없는 직원 전원에게 발급해요.\n번호는 이번 한 번만 화면에 보여요.',
            confirmText: '발급',
          }
        : {
            title: `${empName}님 PIN을 초기화할까요?`,
            message: '모든 기기에서 로그인이 풀리고\n새 임시 PIN이 발급돼요.',
            confirmText: '초기화',
          }
    )
    if (!ok) return
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
        <p className="text-[15px] font-bold text-ink-900">직원 등록</p>
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
          {submitting ? '등록하는 중' : '등록'}
        </button>
        {error && <p role="alert" className="text-[14px] font-semibold text-red-700">{error}</p>}
      </div>

      <BulkEmployeeAdd onDone={fetchList} />

      <div className="card space-y-2">
        <p className="text-[15px] font-bold text-ink-900">본인 확인 PIN</p>
        <p className="text-[13px] text-ink-600">PIN이 없는 직원은 처음 들어올 때 직접 PIN을 정해요. 임시 PIN 발급은 PIN을 잊은 직원처럼 필요할 때만 쓰면 돼요.</p>
        <p className="text-[13px] text-ink-600">
          PIN 없음 {missingCount}명 · 임시 PIN {list.filter((e) => e.pin_status === 'temp').length}명 ·
          등록 {list.filter((e) => e.pin_status === 'set').length}명
        </p>
        <button
          onClick={() => issuePins('missing')}
          disabled={issuing || missingCount === 0}
          className="btn-primary"
        >
          {issuing ? '발급하는 중' : `PIN 없는 직원 ${missingCount}명 임시 PIN 발급`}
        </button>
      </div>

      <div>
        <p className="mb-2 text-[15px] font-bold text-ink-900">
          직원 목록 ({list.length}명)
        </p>
        {loading ? (
          <div className="h-20 animate-pulse rounded-md bg-ink-100" />
        ) : list.length === 0 ? (
          <div className="card text-center text-sm text-ink-400">등록된 직원이 없어요.</div>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {list.map((emp) => (
              <li key={emp.id} className="py-3.5">
                {editingId === emp.id ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="이름"
                      className="input-field py-2"
                    />
                    <input
                      value={editEmpNo}
                      onChange={(e) => setEditEmpNo(e.target.value)}
                      placeholder="사번"
                      className="input-field py-2"
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
                          +
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
                      <button onClick={handleUpdate} className="btn-primary flex-1">
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="btn-secondary"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: getEmployeeColor(emp) }}
                        aria-hidden="true"
                      />
                      <span className={`text-[15px] font-bold ${emp.left_at ? 'text-ink-500 line-through' : 'text-ink-900'}`}>{emp.name}</span>
                      <span className="text-[13px] tabular-nums text-ink-500">#{emp.employee_number}</span>
                      <span className={`text-[13px] font-semibold ${PIN_BADGE[emp.pin_status].cls}`}>· {PIN_BADGE[emp.pin_status].label}</span>
                    </div>
                    <p className="text-[13px] text-ink-600">
                      {emp.department ? `${emp.department.name} (${emp.department.since}부터)` : '부서 없음'}
                      {emp.left_at && <span className="ml-1 font-semibold text-red-700">· {emp.left_at} 퇴사</span>}
                    </p>
                    {mode?.id === emp.id && (
                      <div className="space-y-2 border-l-2 border-ink-900 pl-3">
                        {mode.kind === 'dept' ? (
                          <>
                            <select value={deptChoice} onChange={(e) => setDeptChoice(e.target.value)} className="input-field py-2" aria-label="부서">
                              <option value="">부서 없음(배정 끝내기)</option>
                              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <label className="flex items-center gap-2 text-[14px] text-ink-700">적용일
                              <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="input-field w-auto py-2" />
                            </label>
                            {depts.length === 0 && <p className="text-[13px] text-ink-500">먼저 &apos;부서&apos; 메뉴에서 부서를 만들어 주세요.</p>}
                            <div className="flex gap-2">
                              <button onClick={() => saveDept(emp)} className="btn-primary flex-1">저장</button>
                              <button onClick={() => setMode(null)} className="btn-secondary">취소</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <label className="flex items-center gap-2 text-[14px] text-ink-700">마지막 근무일
                              <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="input-field w-auto py-2" />
                            </label>
                            <div className="flex gap-2">
                              <button onClick={() => saveRetire(emp)} className="btn-primary flex-1">퇴사 처리</button>
                              <button onClick={() => setMode(null)} className="btn-secondary">취소</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <div className="-mr-2.5 flex flex-wrap justify-end gap-1">
                      <button onClick={() => openMode(emp, 'dept')} className="pill-action text-ink-700">부서</button>
                      {emp.left_at ? (
                        <button onClick={() => saveRetire(emp, true)} className="pill-action text-ink-700">퇴사 취소</button>
                      ) : (
                        <button onClick={() => openMode(emp, 'retire')} className="pill-action text-ink-700">퇴사</button>
                      )}
                      <button
                        onClick={() => startEdit(emp)}
                        className="pill-action text-ink-700"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => issuePins('reset', emp.id, emp.name)}
                        disabled={issuing}
                        className="pill-action text-ink-700"
                      >
                        PIN 초기화
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id, emp.name)}
                        className="pill-action text-red-700"
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
