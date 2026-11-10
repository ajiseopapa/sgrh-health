// 서버 전용 Supabase 클라이언트 (service_role 키).
// ⚠️ 이 파일은 app/api/** 의 서버 코드에서만 import 합니다. 화면 컴포넌트에서 쓰면 키가 노출됩니다.
// 키 이름에 NEXT_PUBLIC_ 이 없으므로 Next.js가 브라우저 번들에 넣지 않습니다.
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function serverDb(): SupabaseClient {
  if (typeof window !== 'undefined') throw new Error('serverDb는 서버에서만 사용할 수 있어요')
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SERVER_DB_NOT_CONFIGURED')
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return cached
}
