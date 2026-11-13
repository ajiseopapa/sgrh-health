import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { fail, handle, ok } from '@/lib/server/guard'
import { feedEmojis, feedLooks } from '@/lib/server/game'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 피드용 나무 단계·장착 아이템 — 본인이 "피드에 보이기"를 켠 직원만. 햇빛 잔액·내역은 내보내지 않음
// 이름 앞 이모지 — 본인이 고른 직원만
export const GET = handle(async (req: NextRequest) => {
  const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').filter(Boolean)
  if (ids.length > 100 || ids.some((id) => !UUID.test(id))) return fail(400, '잘못된 요청이에요.')
  const db = serverDb()
  const uniq = [...new Set(ids)]
  const [looks, emojis] = await Promise.all([feedLooks(db, uniq), feedEmojis(db, uniq)])
  return ok({ looks, emojis })
})
