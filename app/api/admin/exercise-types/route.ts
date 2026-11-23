import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { cleanText } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, writeAudit } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

export const POST = handle(async (req: NextRequest) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  const body = await readJson<{ name?: string; icon?: string; trackDistance?: boolean }>(req)
  const name = cleanText(body?.name, 30)
  if (!name) return fail(400, '운동 이름을 입력해주세요.')
  const icon = cleanText(body?.icon, 16) ?? '🏃'
  const { data, error } = await serverDb()
    .from('exercise_types')
    .insert({ name, icon, track_distance: body?.trackDistance === true })
    .select('*')
    .single()
  if (error) return fail(400, '등록에 실패했어요.')
  await writeAudit({ table: 'exercise_types', recordId: data.id, action: 'insert', actorType: 'admin', after: data })
  return ok()
})
