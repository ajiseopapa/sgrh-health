import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { cleanText, UUID_RE } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, writeAudit } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')
  const body = await readJson<{ name?: string; icon?: string; trackDistance?: boolean }>(req)
  const name = cleanText(body?.name, 30)
  if (!name) return fail(400, '운동 이름을 입력해주세요.')
  const icon = cleanText(body?.icon, 16) ?? '🏃'

  const db = serverDb()
  const { data: before } = await db.from('exercise_types').select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail(404, '종목을 찾을 수 없어요.')
  const { data, error } = await db
    .from('exercise_types')
    .update({ name, icon, track_distance: body?.trackDistance === true })
    .eq('id', params.id)
    .select('*')
    .single()
  if (error) return fail(400, '수정에 실패했어요.')
  await writeAudit({ table: 'exercise_types', recordId: params.id, action: 'update', actorType: 'admin', before, after: data })
  return ok()
})

export const DELETE = handle(async (req: NextRequest, { params }: Ctx) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')
  const db = serverDb()
  const { data: before } = await db.from('exercise_types').select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail(404, '종목을 찾을 수 없어요.')
  const { error } = await db.from('exercise_types').delete().eq('id', params.id)
  if (error) {
    return fail(400, error.code === '23503' ? `'${before.name}'으로 기록된 운동 일지가 있어서 삭제할 수 없어요.` : '삭제에 실패했어요.')
  }
  await writeAudit({ table: 'exercise_types', recordId: params.id, action: 'delete', actorType: 'admin', before })
  return ok()
})
