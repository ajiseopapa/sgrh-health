import { serverDb } from '@/lib/server/db'
import { getSession } from '@/lib/server/session'
import { handle, ok } from '@/lib/server/guard'

export const dynamic = 'force-dynamic'

// 지금 기기에서 확인된 "나"와 관리자 여부
export const GET = handle(async () => {
  const [emp, admin] = await Promise.all([getSession('employee'), getSession('admin')])
  let me = null
  let mustChangePin = false
  if (emp?.employeeId) {
    const db = serverDb()
    const [{ data: e }, { data: p }] = await Promise.all([
      db.from('employees').select('id, name, employee_number, color, left_at').eq('id', emp.employeeId).maybeSingle(),
      db.from('employee_pins').select('is_temp').eq('employee_id', emp.employeeId).maybeSingle(),
    ])
    // v2.1: 퇴사일이 지난 직원은 로그인 안 된 것으로 표시
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
    if (e && p && !(e.left_at && e.left_at < today)) {
      const { left_at: _l, ...rest } = e
      void _l
      me = rest
      mustChangePin = p.is_temp
    }
  }
  return ok({ me, mustChangePin, isAdmin: !!admin })
})
