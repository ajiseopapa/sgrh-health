import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { cleanText, UUID_RE } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, writeAudit } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

// 관리자: 부서 이름·순서 변경. 부서 삭제는 두지 않음(과거 부서 이력 보존)
export const PATCH = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')
  const body = await readJson<{ name?: string; sortOrder?: unknown }>(req)
  const patch: Record<string, unknown> = {}
  if (body?.name !== undefined) {
    const name = cleanText(body.name, 30)
    if (!name) return fail(400, '부서 이름을 입력해주세요.')
    patch.name = name
  }
  if (body?.sortOrder !== undefined) {
    const n = Number(body.sortOrder)
    if (!Number.isInteger(n) || n < 0 || n > 1000) return fail(400, '순서 값이 올바르지 않아요.')
    patch.sort_order = n
  }
  if (Object.keys(patch).length === 0) return fail(400, '바꿀 내용이 없어요.')
  const db = serverDb()
  const { data: before } = await db.from('departments').select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail(404, '부서를 찾을 수 없어요.')
  const { data, error } = await db.from('departments').update(patch).eq('id', params.id).select('*').single()
  if (error) return fail(400, error.code === '23505' ? '이미 있는 부서 이름이에요.' : '수정하지 못했어요.')
  await writeAudit({ table: 'departments', recordId: params.id, action: 'update', actorType: 'admin', before, after: data })
  return ok({ department: data })
})
