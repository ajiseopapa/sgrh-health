import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { cleanText } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, writeAudit } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

export const POST = handle(async (req: NextRequest) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  const body = await readJson<{ title?: string; content?: string }>(req)
  const title = cleanText(body?.title, 100)
  const content = cleanText(body?.content, 5000)
  if (!title || !content) return fail(400, '제목과 내용을 입력해주세요.')
  const { data, error } = await serverDb().from('announcements').insert({ title, content }).select('*').single()
  if (error) return fail(400, '저장에 실패했어요.')
  await writeAudit({ table: 'announcements', recordId: data.id, action: 'insert', actorType: 'admin', after: data })
  return ok()
})
