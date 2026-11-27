import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { checkCsrf, fail, handle, hitRateLimit, isAdminRequest, limitWrites, ok, readJson, requireEmployee, writeAudit } from '@/lib/server/guard'
import { UUID_RE } from '@/lib/server/validate'
import { isNameEmoji } from '@/lib/game'

export const dynamic = 'force-dynamic'

// 정원 방명록 — 동료 정원(프로필 창)과 내 정원 탭 아래에 보입니다.
// 읽기·쓰기 모두 본인 확인한 직원만(병원 안 이야기라 로그인 없이 공개하지 않음).
// 지우기는 쓴 사람 · 정원 주인 · 관리자.
const BODY_MAX = 100
const LIST_MAX = 50
const NOT_READY = new Set(['42P01', 'PGRST205']) // 037 실행 전 DB: 표가 없음

interface Row { id: string; owner_id: string; author_id: string; body: string; created_at: string }

export const GET = handle(async (req: NextRequest) => {
  const ownerId = req.nextUrl.searchParams.get('id') ?? ''
  if (!UUID_RE.test(ownerId)) return fail(400, '잘못된 요청이에요.')
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  const db = serverDb()
  const { data, error } = await db.from('garden_guestbook').select('id, owner_id, author_id, body, created_at')
    .eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(LIST_MAX)
  if (error) {
    if (NOT_READY.has(error.code)) return ok({ ready: false, entries: [] })
    throw new Error('GUESTBOOK_READ_FAILED')
  }
  const rows = (data ?? []) as Row[]
  const ids = [...new Set(rows.map((r) => r.author_id))]
  const [emps, profiles] = ids.length
    ? await Promise.all([
      db.from('employees').select('id, name').in('id', ids),
      db.from('game_profiles').select('employee_id, name_emoji').in('employee_id', ids),
    ])
    : [{ data: [] }, { data: [] }]
  const nameOf = new Map((emps.data ?? []).map((e) => [e.id as string, e.name as string]))
  const emojiOf = new Map((profiles.data ?? []).filter((p) => isNameEmoji(p.name_emoji)).map((p) => [p.employee_id as string, p.name_emoji as string]))
  const admin = await isAdminRequest()
  return ok({
    ready: true,
    entries: rows.map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.created_at,
      author: { id: r.author_id, name: nameOf.get(r.author_id) ?? '알 수 없음', emoji: emojiOf.get(r.author_id) ?? null },
      mine: r.author_id === auth.employeeId,
      canDelete: admin || r.author_id === auth.employeeId || r.owner_id === auth.employeeId,
    })),
  })
})

export const POST = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  const auth = await requireEmployee()
  if (auth instanceof NextResponse) return auth
  const body = await readJson<{ ownerId?: unknown; body?: unknown }>(req)
  const ownerId = typeof body?.ownerId === 'string' ? body.ownerId : ''
  if (!UUID_RE.test(ownerId)) return fail(400, '잘못된 요청이에요.')
  if (typeof body?.body !== 'string') return fail(400, '남길 글을 적어주세요.')
  const text = body.body.replace(/\s+/g, ' ').trim()
  if (!text) return fail(400, '남길 글을 적어주세요.')
  if ([...text].length > BODY_MAX) return fail(400, `방명록은 ${BODY_MAX}자까지 적을 수 있어요.`)

  // 한 사람이 10분에 10개까지(도배 방지)
  if (!(await hitRateLimit(`guestbook:${auth.employeeId}`, 10, 600))) return fail(429, '잠시 후에 다시 남겨주세요.')

  const db = serverDb()
  const { data: owner } = await db.from('employees').select('id').eq('id', ownerId).maybeSingle()
  if (!owner) return fail(404, '정원을 찾을 수 없어요.')
  const { data, error } = await db.from('garden_guestbook')
    .insert({ owner_id: ownerId, author_id: auth.employeeId, body: text })
    .select('id, created_at').single()
  if (error) {
    if (NOT_READY.has(error.code)) return fail(503, '방명록은 준비 중이에요.')
    throw new Error('GUESTBOOK_WRITE_FAILED')
  }
  return ok({ id: data.id, createdAt: data.created_at })
})

export const DELETE = handle(async (req: NextRequest) => {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const limited = await limitWrites(req)
  if (limited) return limited
  const body = await readJson<{ id?: unknown }>(req)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!UUID_RE.test(id)) return fail(400, '잘못된 요청이에요.')

  const admin = await isAdminRequest()
  let employeeId: string | null = null
  if (!admin) {
    const auth = await requireEmployee()
    if (auth instanceof NextResponse) return auth
    employeeId = auth.employeeId
  }
  const db = serverDb()
  const { data: row, error } = await db.from('garden_guestbook').select('id, owner_id, author_id, body, created_at').eq('id', id).maybeSingle()
  if (error) {
    if (NOT_READY.has(error.code)) return fail(503, '방명록은 준비 중이에요.')
    throw new Error('GUESTBOOK_READ_FAILED')
  }
  if (!row) return ok({ deleted: false }) // 이미 지워짐
  if (!admin && row.author_id !== employeeId && row.owner_id !== employeeId) return fail(403, '내가 쓴 글이나 내 정원의 글만 지울 수 있어요.')
  const { error: delErr } = await db.from('garden_guestbook').delete().eq('id', id)
  if (delErr) throw new Error('GUESTBOOK_DELETE_FAILED')
  // 남이 쓴 글을 지운 경우(정원 주인·관리자)만 기록
  if (row.author_id !== employeeId) {
    await writeAudit({ table: 'garden_guestbook', recordId: id, action: 'delete', actorType: admin ? 'admin' : 'employee', actorEmployeeId: employeeId, before: row })
  }
  return ok({ deleted: true })
})
