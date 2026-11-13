import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { UUID_RE } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, writeAudit } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

// 건의 확인 처리 / 답변 저장 (관리자)
export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')
  const body = await readJson<{ markRead?: boolean; reply?: string }>(req)

  let patch: Record<string, unknown>
  if (body?.markRead === true) {
    patch = { status: 'read' }
  } else if (typeof body?.reply === 'string') {
    const reply = body.reply.trim()
    if (reply.length > 3000) return fail(400, '답변이 너무 길어요.')
    patch = reply
      ? { admin_reply: reply, status: 'answered', replied_at: new Date().toISOString() }
      : { admin_reply: null, status: 'read', replied_at: null }
  } else {
    return fail(400, '요청 형식이 올바르지 않아요.')
  }

  const db = serverDb()
  const { data: before } = await db.from('suggestions').select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail(404, '건의를 찾을 수 없어요.')
  if (body.markRead && before.status !== 'new') return ok()
  const { error } = await db.from('suggestions').update(patch).eq('id', params.id)
  if (error) return fail(400, '저장에 실패했어요.')
  if (!body.markRead) await writeAudit({ table: 'suggestions', recordId: params.id, action: 'update', actorType: 'admin', before, after: patch })
  return ok()
})

export const DELETE = handle(async (req: NextRequest, { params }: Ctx) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')
  const db = serverDb()
  const { data: before } = await db.from('suggestions').select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail(404, '건의를 찾을 수 없어요.')
  await db.from('suggestions').delete().eq('id', params.id)
  await writeAudit({ table: 'suggestions', recordId: params.id, action: 'delete', actorType: 'admin', before })
  return ok()
})
