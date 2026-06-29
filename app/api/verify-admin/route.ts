import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const correctPassword = process.env.ADMIN_PASSWORD

  if (!correctPassword) {
    // 환경변수가 설정 안 된 경우, 안전하게 항상 실패시킵니다.
    return NextResponse.json(
      { ok: false, message: 'ADMIN_PASSWORD가 서버에 설정되어 있지 않아요.' },
      { status: 500 }
    )
  }

  const ok = password === correctPassword
  return NextResponse.json({ ok })
}
