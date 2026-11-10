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
  const body = await readJson<{ title?: string; content?: string }>(req)
  const title = cleanText(body?.title, 100)
  const content = cleanText(body?.content, 5000)
  if (!title || !content) return fail(400, '제목과 내용을 입력해주세요.')
  const db = serverDb()
  const { data: before } = await db.from('announcements').select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail(404, '공지를 찾을 수 없어요.')
  const { data, error } = await db.from('announcements').update({ title, content }).eq('id', params.id).select('*').single()
  if (error) return fail(400, '저장에 실패했어요.')
  await writeAudit({ table: 'announcements', recordId: params.id, action: 'update', actorType: 'admin', before, after: data })
  return ok()
})

export const DELETE = handle(async (req: NextRequest, { params }: Ctx) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')
  const db = serverDb()
  const { data: before } = await db.from('announcements').select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail(404, '공지를 찾을 수 없어요.')
  await db.from('announcements').delete().eq('id', params.id)
  await writeAudit({ table: 'announcements', recordId: params.id, action: 'delete', actorType: 'admin', before })
  return ok()
})
