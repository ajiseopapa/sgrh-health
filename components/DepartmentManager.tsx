'use client'

// 관리자: 부서 만들기·이름 바꾸기 + 인사팀이 확인한 월별 부서 인원 입력
// 인원은 직원 수나 배정 인원으로 추정하지 않습니다. 입력한 달만 부서 참여율을 계산하고, 없으면 "인원 정보 없음".
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Empty, Loading, Notice } from '@/lib/ui'

interface Head { year_month: string; headcount: number; source: string | null; updated_at: string }
interface Dept { id: string; name: string; sort_order: number; members: number; headcount: Head | null; headcounts: Head[] }
interface Mismatch { id: string; name: string; participants: number; headcount: number | null }

export default function DepartmentManager() {
  const [list, setList] = useState<Dept[] | null>(null)
  const [mismatches, setMismatches] = useState<Mismatch[]>([])
  const [failed, setFailed] = useState(false) // 불러오기 실패(권한 등) — 빈 목록 문구를 띄우지 않음
  const [ym, setYm] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [hc, setHc] = useState('')
  const [src, setSrc] = useState('')
  const [rename, setRename] = useState('')

  async function load() {
    const r = await api<{ yearMonth: string; departments: Dept[]; mismatches: Mismatch[] }>('/api/admin/departments')
    if (!r.ok) { setMsg({ tone: 'error', text: r.message }); setFailed(true); setList([]); return }
    setFailed(false)
    setList(r.data.departments)
    setMismatches(r.data.mismatches ?? [])
    setYm((v) => v || r.data.yearMonth)
  }
  useEffect(() => { load() }, [])

  async function add() {
    setMsg(null)
    const r = await api('/api/admin/departments', { method: 'POST', body: { name } })
    if (!r.ok) { setMsg({ tone: 'error', text: r.message }); return }
    setName('')
    load()
  }

  function open(d: Dept) {
    setEditing(d.id)
    const h = d.headcounts.find((x) => x.year_month === ym)
    setHc(h ? String(h.headcount) : '')
    setSrc(h?.source ?? '')
    setRename(d.name)
    setMsg(null)
  }

  async function saveHead(d: Dept, clear = false) {
    const r = await api(`/api/admin/departments/${d.id}/headcount`, {
      method: 'PUT',
      body: clear ? { yearMonth: ym, headcount: null } : { yearMonth: ym, headcount: Number(hc), source: src },
    })
    if (!r.ok) { setMsg({ tone: 'error', text: r.message }); return }
    if (rename.trim() && rename.trim() !== d.name) {
      const r2 = await api(`/api/admin/departments/${d.id}`, { method: 'PATCH', body: { name: rename.trim() } })
      if (!r2.ok) { setMsg({ tone: 'error', text: r2.message }); return }
    }
    setEditing(null)
    await load()
    const shown = rename.trim() || d.name
    setMsg({ tone: 'success', text: clear ? `${shown} ${ym} 인원 자료를 지웠어요.` : `${shown} ${ym} 인원을 저장했어요.` })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        <p className="text-[15px] font-bold text-ink-900">부서 만들기</p>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="부서 이름" maxLength={30} className="input-field flex-1" aria-label="부서 이름" />
          <button onClick={add} disabled={!name.trim()} className="btn-primary w-auto px-5">추가</button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[15px] font-bold text-ink-900">인사팀 확인 인원</p>
          <label className="flex items-center gap-2 text-[13px] text-ink-600">
            기준 월
            <input type="month" value={ym} onChange={(e) => { setYm(e.target.value); setEditing(null) }} className="input-field w-auto py-1.5 text-[14px]" />
          </label>
        </div>
        <p className="mb-3 text-[13px] leading-relaxed text-ink-500">
          인사팀 자료로 확인한 인원만 입력하세요. 입력한 달만 부서 참여율이 나오고, 없으면 &lsquo;인원 정보 없음&rsquo;으로 보여요. 배정 인원은 참고용이에요.
        </p>
        {mismatches.length > 0 && (
          <div role="alert" className="mb-4 border-l-2 border-red-700 pl-3">
            <p className="text-[14px] font-bold text-red-700">인원 확인 필요 {mismatches.length}개 부서</p>
            <ul className="mt-1 space-y-0.5 text-[13px] text-ink-700">
              {mismatches.map((m) => (
                <li key={m.id}>{m.name}: 이번 달 참여 {m.participants}명 &gt; 인사팀 인원 {m.headcount}명</li>
              ))}
            </ul>
            <p className="mt-1 text-[13px] text-ink-500">직원 화면에는 참여율 대신 &lsquo;인원 확인 필요&rsquo;로 보여요. 인사팀 인원이나 직원 소속을 확인해 주세요.</p>
          </div>
        )}
        {msg && <div className="mb-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
        {!list ? <Loading /> : failed ? null : list.length === 0 ? (
          <Empty title="아직 부서가 없어요." desc="위에서 부서를 만든 뒤, 직원 메뉴에서 소속을 정해 주세요." />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {list.map((d) => {
              const h = d.headcounts.find((x) => x.year_month === ym)
              return (
                <li key={d.id} className="py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-bold text-ink-900">{d.name}</p>
                      <p className="mt-0.5 text-[13px] text-ink-600">
                        배정 {d.members}명 · {h ? <>인사팀 {h.headcount}명 <span className="text-ink-500">({h.source})</span></> : <span className="font-semibold">인원 정보 없음</span>}
                      </p>
                    </div>
                    <button onClick={() => open(d)} className="pill-action -mr-2.5 shrink-0 text-ink-700">{h ? '수정' : '인원 입력'}</button>
                  </div>
                  {editing === d.id && (
                    <div className="mt-3 space-y-2 border-l-2 border-ink-900 pl-3">
                      <label className="block text-[13px] text-ink-600">부서 이름
                        <input value={rename} onChange={(e) => setRename(e.target.value)} maxLength={30} className="input-field mt-1 py-2" />
                      </label>
                      <div className="flex gap-2">
                        <label className="w-28 text-[13px] text-ink-600">{ym} 인원
                          <input type="number" inputMode="numeric" min={1} value={hc} onChange={(e) => setHc(e.target.value)} className="input-field mt-1 py-2 text-right tabular-nums" />
                        </label>
                        <label className="flex-1 text-[13px] text-ink-600">자료 출처
                          <input value={src} onChange={(e) => setSrc(e.target.value)} maxLength={60} placeholder="예: 인사팀 11월 인원 현황" className="input-field mt-1 py-2" />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveHead(d)} className="btn-primary flex-1">저장</button>
                        {h && <button onClick={() => saveHead(d, true)} className="btn-secondary">이 달 인원 지우기</button>}
                        <button onClick={() => setEditing(null)} className="btn-secondary">취소</button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
