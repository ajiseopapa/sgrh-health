'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Employee } from '@/types/database'

export default function EmployeeManager() {
  const [list, setList] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [empNo, setEmpNo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmpNo, setEditEmpNo] = useState('')

  async function fetchList() {
    setLoading(true)
    const { data } = await supabase.from('employees').select('*').order('name')
    setList(data ?? [])
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
    const { error } = await supabase
      .from('employees')
      .insert({ name: name.trim(), employee_number: empNo.trim() })
    setSubmitting(false)
    if (error) {
      setError(error.code === '23505' ? '이미 등록된 사번이에요.' : '등록에 실패했어요.')
      return
    }
    setName('')
    setEmpNo('')
    fetchList()
  }

  function startEdit(emp: Employee) {
    setEditingId(emp.id)
    setEditName(emp.name)
    setEditEmpNo(emp.employee_number ?? '')
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
    const { error } = await supabase
      .from('employees')
      .update({ name: editName.trim(), employee_number: editEmpNo.trim() })
      .eq('id', editingId)
    if (error) {
      setError(error.code === '23505' ? '이미 등록된 사번이에요.' : '수정에 실패했어요.')
      return
    }
    setEditingId(null)
    setError('')
    fetchList()
  }

  async function handleDelete(id: string, empName: string) {
    const ok = window.confirm(`'${empName}'님을 삭제하면 관련 운동 기록도 함께 삭제돼요.\n계속할까요?`)
    if (!ok) return
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) {
      setError('삭제에 실패했어요.')
      return
    }
    fetchList()
  }

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
                    <div className="flex gap-2 pt-0.5">
                      <button onClick={handleUpdate} className="btn-primary py-1.5 text-xs">
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
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium text-ink-800">{emp.name}</span>
                      <span className="ml-2 text-xs text-ink-300">#{emp.employee_number}</span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(emp)}
                        className="pill-action bg-brand-50 text-brand-700"
                      >
                        수정
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
