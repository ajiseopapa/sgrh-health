'use client'

// 관리 › 직원: 엑셀로 한 번에 등록. 열 순서는 사번 / 부서명 / 직위 / 사원명.
// .xlsx 파일을 고르거나, 엑셀에서 칸을 복사해 붙여넣습니다. 올리기 전에 몇 줄인지와 앞 5줄을 보여 줍니다.
import { useState } from 'react'
import { api } from '@/lib/api'
import { BulkRow, parseTable, readXlsx, toBulkRows } from '@/lib/sheet'

interface Result { added: number; skipped: { employeeNumber: string; name: string }[]; invalid: { line: number; reason: string }[]; newDepartments: string[] }

export default function BulkEmployeeAdd({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<BulkRow[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  function take(table: string[][]) {
    const r = toBulkRows(table)
    setRows(r); setResult(null)
    setError(r.length ? '' : '읽을 줄이 없어요. 사번 / 부서명 / 직위 / 사원명 순서인지 확인해주세요.')
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(''); setText('')
    try {
      if (/\.csv$/i.test(file.name)) take(parseTable(await file.text()))
      else if (/\.xlsx$/i.test(file.name)) take(await readXlsx(file))
      else { setRows([]); setError('.xlsx 또는 .csv 파일만 읽을 수 있어요. 옛 형식(.xls)은 엑셀에서 "다른 이름으로 저장 → Excel 통합 문서(.xlsx)"로 바꿔주세요.') }
    } catch {
      setRows([]); setError('파일을 읽지 못했어요. 엑셀에서 칸을 복사해 아래 칸에 붙여넣어 보세요.')
    }
  }

  async function submit() {
    if (busy || rows.length === 0) return
    setBusy(true); setError('')
    const r = await api<Result>('/api/admin/employees/bulk', { method: 'POST', body: { rows } })
    setBusy(false)
    if (!r.ok) { setError(r.message || '등록하지 못했어요.'); return }
    setResult(r.data); setRows([]); setText('')
    onDone()
  }

  if (!open) {
    return (
      <div className="card space-y-2">
        <p className="text-[15px] font-bold text-ink-900">엑셀로 한 번에 등록</p>
        <p className="text-[13px] text-ink-600">사번 / 부서명 / 직위 / 사원명 순서의 엑셀 파일로 여러 명을 한 번에 등록해요.</p>
        <button onClick={() => setOpen(true)} className="btn-secondary">엑셀 등록 열기</button>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-bold text-ink-900">엑셀로 한 번에 등록</p>
        <button onClick={() => setOpen(false)} className="min-h-[44px] px-2 text-[13px] font-semibold text-ink-500">접기</button>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-600">
        <li>열 순서: <span className="font-bold text-ink-900">사번 / 부서명 / 직위 / 사원명</span>. 첫 줄이 제목이면 알아서 건너뛰어요.</li>
        <li>이미 있는 사번은 건너뛰어요. 이름이나 부서를 덮어쓰지 않아요.</li>
        <li>처음 보는 부서명은 부서를 새로 만들어요. 직위는 저장하지 않아요.</li>
        <li>숫자만 있는 5자리 이하 사번은 앞에 0을 채워 6자리로 맞춰요.</li>
        <li>PIN은 직원이 처음 들어올 때 직접 정해요.</li>
      </ul>

      <label className="block">
        <span className="mb-1 block text-[13px] font-bold text-ink-700">엑셀 파일(.xlsx)</span>
        <input type="file" accept=".xlsx,.csv" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }}
          className="block w-full text-[14px] text-ink-700 file:mr-3 file:min-h-[44px] file:rounded-lg file:border file:border-ink-300 file:bg-paper file:px-4 file:text-[14px] file:font-bold file:text-ink-900" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] font-bold text-ink-700">또는 엑셀에서 칸을 복사해 붙여넣기</span>
        <textarea value={text} rows={4} placeholder={'134006\t기획홍보팀\t팀장\t홍길동'}
          onChange={(e) => { setText(e.target.value); if (e.target.value.trim()) take(parseTable(e.target.value)); else { setRows([]); setError('') } }}
          className="input-field font-mono text-[13px]" />
      </label>

      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-[14px] font-bold text-ink-900">{rows.length}줄을 읽었어요. 앞 {Math.min(5, rows.length)}줄:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="text-ink-500"><th className="py-1 pr-3 font-semibold">사번</th><th className="py-1 pr-3 font-semibold">부서명</th><th className="py-1 pr-3 font-semibold">직위</th><th className="py-1 font-semibold">사원명</th></tr></thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-line text-ink-900">
                    <td className="py-1.5 pr-3 tabular-nums">{r.employeeNumber || '—'}</td><td className="py-1.5 pr-3">{r.department || '—'}</td><td className="py-1.5 pr-3">{r.position || '—'}</td><td className="py-1.5">{r.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={submit} disabled={busy} className="btn-primary">{busy ? '등록하는 중' : `${rows.length}줄 등록`}</button>
        </div>
      )}

      {error && <p role="alert" className="text-[14px] font-semibold text-red-700">{error}</p>}

      {result && (
        <div role="status" className="space-y-1.5 rounded-xl bg-brand-50 px-4 py-3 text-[14px] text-ink-900">
          <p className="font-bold">{result.added}명을 등록했어요.</p>
          {result.newDepartments.length > 0 && <p>새로 만든 부서: {result.newDepartments.join(', ')}</p>}
          {result.skipped.length > 0 && <p>이미 있어서 건너뜀 {result.skipped.length}명: {result.skipped.slice(0, 10).map((s) => `${s.name}(${s.employeeNumber})`).join(', ')}{result.skipped.length > 10 ? ' …' : ''}</p>}
          {result.invalid.length > 0 && (
            <div>
              <p className="font-semibold text-red-700">등록하지 못한 줄 {result.invalid.length}개</p>
              <ul className="list-disc pl-5">{result.invalid.slice(0, 10).map((v) => <li key={v.line}>{v.line}번째 줄: {v.reason}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
