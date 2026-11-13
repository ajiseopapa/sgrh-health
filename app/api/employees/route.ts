import { serverDb } from '@/lib/server/db'
import { handle, ok } from '@/lib/server/guard'
import { kstToday } from '@/lib/server/engagement'

export const dynamic = 'force-dynamic'

// 본인 확인의 이름 목록 — 재직 중인 직원만, 화면에 필요한 칸만.
// 퇴사일(left_at)은 공개 키로 읽을 수 없게 막았으므로(025), 퇴사자 거르기는 서버에서 합니다.
export const GET = handle(async () => {
  const today = kstToday()
  const rows: { id: string; name: string; employee_number: string; color: string | null; left_at: string | null }[] = []
  for (let off = 0; ; off += 1000) {
    const { data, error } = await serverDb()
      .from('employees')
      .select('id, name, employee_number, color, left_at')
      .order('name')
      .order('id')
      .range(off, off + 999)
    if (error) throw new Error('EMPLOYEES_READ_FAILED')
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return ok({
    employees: rows
      .filter((e) => !e.left_at || e.left_at >= today)
      .map(({ id, name, employee_number, color }) => ({ id, name, employee_number, color })),
  })
})
