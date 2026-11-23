import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { cleanText, UUID_RE } from '@/lib/server/validate'
import { fail, guardAdminWrite, handle, ok, readJson, writeAudit } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

const YM_RE = /^[0-9]{4}-(0[1-9]|1[0-2])$/

// 관리자: 인사팀이 확인한 부서 인원을 월 단위로 입력. headcount 가 null 이면 그 달 자료를 지움(→ "인원 정보 없음")
// 직원 수나 배정 인원으로 추정하지 않습니다. 이 값이 있을 때만 부서 참여율을 계산합니다.
export const PUT = handle(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const g = await guardAdminWrite(req)
  if (g) return g
  if (!UUID_RE.test(params.id)) return fail(400, '요청 형식이 올바르지 않아요.')
  const body = await readJson<{ yearMonth?: string; headcount?: unknown; source?: string }>(req)
  const yearMonth = String(body?.yearMonth ?? '')
  if (!YM_RE.test(yearMonth)) return fail(400, '월을 다시 골라주세요.')
  const db = serverDb()
  const { data: dept } = await db.from('departments').select('id').eq('id', params.id).maybeSingle()
  if (!dept) return fail(404, '부서를 찾을 수 없어요.')
  const { data: before } = await db.from('department_headcounts').select('*').eq('department_id', params.id).eq('year_month', yearMonth).maybeSingle()

  if (body?.headcount === null) {
    await db.from('department_headcounts').delete().eq('department_id', params.id).eq('year_month', yearMonth)
    await writeAudit({ table: 'department_headcounts', recordId: params.id, action: 'delete', actorType: 'admin', before })
    return ok({ headcount: null })
  }
  const headcount = Number(body?.headcount)
  if (!Number.isInteger(headcount) || headcount < 1 || headcount > 10000) return fail(400, '인원은 1명 이상의 숫자로 입력해주세요.')
  const source = cleanText(body?.source, 60)
  if (!source) return fail(400, '자료 출처를 적어주세요. (예: 인사팀 11월 인원 현황)')
  const { data, error } = await db
    .from('department_headcounts')
    .upsert({ department_id: params.id, year_month: yearMonth, headcount, source, updated_at: new Date().toISOString() }, { onConflict: 'department_id,year_month' })
    .select('*')
    .single()
  if (error) throw new Error('HEADCOUNT_SAVE_FAILED')
  await writeAudit({ table: 'department_headcounts', recordId: params.id, action: before ? 'update' : 'insert', actorType: 'admin', before, after: data })
  return ok({ headcount: data })
})
