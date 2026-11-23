import { NextRequest } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { fail, handle, ok } from '@/lib/server/guard'
import { peerProfile } from '@/lib/server/game'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 동료 프로필 — 피드에서 이름·이모지를 눌렀을 때. 이모지·한마디, 캐릭터는 본인이 보이기를 켠 직원만.
// 햇빛·기록 수 같은 숫자는 내보내지 않음
export const GET = handle(async (req: NextRequest) => {
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!UUID.test(id)) return fail(400, '잘못된 요청이에요.')
  return ok({ profile: await peerProfile(serverDb(), id) })
})
