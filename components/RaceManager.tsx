'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Race } from '@/types/database'
import { formatRaceDate } from '@/lib/races'

const emptyForm = { name: '', race_date: '', location: '', distances: '', source_name: '', source_url: '', registration_deadline: '' }

export default function RaceManager() {
  const [list, setList] = useState<Race[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)

  async function fetchList() {
    setLoading(true)
    const { data } = await supabase.from('races').select('*').order('race_date')
    setList(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchList() }, [])

  async function handleAdd() {
    if (!form.name.trim())      { setError('대회명을 입력해주세요.'); return }
    if (!form.race_date)        { setError('날짜를 입력해주세요.'); return }
    if (!form.location.trim())  { setError('장소를 입력해주세요.'); return }
    setSubmitting(true); setError('')
    const { error } = await supabase.from('races').insert({
      name: form.name.trim(),
      race_date: form.race_date,
      location: form.location.trim(),
      distances: form.distances.trim(),
      source_name: form.source_name.trim() || null,
      source_url: form.source_url.trim() || null,
      registration_deadline: form.registration_deadline || null,
    })
    setSubmitting(false)
    if (error) { setError(`등록에 실패했어요: ${error.message}`); return }
    setForm(emptyForm)
    fetchList()
  }

  function startEdit(race: Race) {
    setEditingId(race.id)
    setEditForm({
      name: race.name,
      race_date: race.race_date,
      location: race.location,
      distances: race.distances,
      source_name: race.source_name ?? '',
      source_url: race.source_url ?? '',
      registration_deadline: race.registration_deadline ?? '',
    })
    setError('')
  }

  async function handleUpdate() {
    if (!editingId) return
    if (!editForm.name.trim() || !editForm.race_date || !editForm.location.trim()) {
      setError('대회명, 날짜, 장소는 필수예요.')
      return
    }
    const { error } = await supabase.from('races').update({
      name: editForm.name.trim(),
      race_date: editForm.race_date,
      location: editForm.location.trim(),
      distances: editForm.distances.trim(),
      source_name: editForm.source_name.trim() || null,
      source_url: editForm.source_url.trim() || null,
      registration_deadline: editForm.registration_deadline || null,
    }).eq('id', editingId)
    if (error) { setError(`수정에 실패했어요: ${error.message}`); return }
    setEditingId(null); setError(''); fetchList()
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`'${name}' 대회를 삭제할까요?`)) return
    const { error } = await supabase.from('races').delete().eq('id', id)
    if (error) { setError(`삭제에 실패했어요: ${error.message}`); return }
    fetchList()
  }

  return (
    <div className="space-y-4">
      {/* 등록 폼 */}
      <div className="card space-y-2.5">
        <p className="text-sm font-semibold text-ink-700">대회 등록</p>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="대회명 (예: 부산바다마라톤)"
          className="input-field"
        />
        <div>
          <label className="mb-1 block text-xs text-ink-400">대회 날짜</label>
          <input
            type="date"
            value={form.race_date}
            onChange={(e) => setForm({ ...form, race_date: e.target.value })}
            className="input-field"
          />
        </div>
        <input
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="장소 (예: 부산 광안리)"
          className="input-field"
        />
        <input
          value={form.distances}
          onChange={(e) => setForm({ ...form, distances: e.target.value })}
          placeholder="거리, 쉼표로 구분 (예: 풀코스,하프,10km)"
          className="input-field"
        />
        <div>
          <label className="mb-1 block text-xs text-ink-400">접수 마감일 (선택)</label>
          <input
            type="date"
            value={form.registration_deadline}
            onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })}
            className="input-field"
          />
        </div>
        <div className="flex gap-2">
          <input
            value={form.source_name}
            onChange={(e) => setForm({ ...form, source_name: e.target.value })}
            placeholder="출처명 (선택)"
            className="input-field flex-1"
          />
        </div>
        <input
          value={form.source_url}
          onChange={(e) => setForm({ ...form, source_url: e.target.value })}
          placeholder="출처 링크 (선택, https://...)"
          className="input-field"
        />
        <button onClick={handleAdd} disabled={submitting} className="btn-primary">
          {submitting ? '등록 중...' : '등록'}
        </button>
        {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      </div>

      {/* 목록 */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          등록된 대회 ({list.length}개)
        </p>
        {loading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-ink-100" />
        ) : list.length === 0 ? (
          <div className="card text-center text-sm text-ink-400">등록된 대회가 없어요.</div>
        ) : (
          <ul className="card divide-y divide-ink-100 p-0">
            {list.map((race) => (
              <li key={race.id} className="px-4 py-3">
                {editingId === race.id ? (
                  <div className="space-y-2">
                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="대회명" className="input-field py-1.5" />
                    <div>
                      <label className="mb-1 block text-xs text-ink-400">대회 날짜</label>
                      <input type="date" value={editForm.race_date} onChange={(e) => setEditForm({ ...editForm, race_date: e.target.value })} className="input-field py-1.5" />
                    </div>
                    <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="장소" className="input-field py-1.5" />
                    <input value={editForm.distances} onChange={(e) => setEditForm({ ...editForm, distances: e.target.value })} placeholder="거리 (쉼표 구분)" className="input-field py-1.5" />
                    <div>
                      <label className="mb-1 block text-xs text-ink-400">접수 마감일 (선택)</label>
                      <input type="date" value={editForm.registration_deadline} onChange={(e) => setEditForm({ ...editForm, registration_deadline: e.target.value })} className="input-field py-1.5" />
                    </div>
                    <input value={editForm.source_name} onChange={(e) => setEditForm({ ...editForm, source_name: e.target.value })} placeholder="출처명" className="input-field py-1.5" />
                    <input value={editForm.source_url} onChange={(e) => setEditForm({ ...editForm, source_url: e.target.value })} placeholder="출처 링크" className="input-field py-1.5" />
                    <div className="flex gap-2 pt-0.5">
                      <button onClick={handleUpdate} className="btn-primary flex-1 py-1.5 text-xs">저장</button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary py-1.5 text-xs">취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-800">{race.name}</p>
                      <p className="text-xs text-ink-400">{formatRaceDate(race.race_date)} · {race.location}</p>
                      {race.distances && (
                        <p className="mt-0.5 text-xs text-ink-300">{race.distances}</p>
                      )}
                      {race.registration_deadline && (
                        <p className="mt-0.5 text-xs text-ink-300">접수마감 {formatRaceDate(race.registration_deadline)}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(race)} className="pill-action bg-brand-50 text-brand-700">수정</button>
                      <button onClick={() => handleDelete(race.id, race.name)} className="pill-action bg-red-50 text-red-500">삭제</button>
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
