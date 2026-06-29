import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  // 빌드 타임에는 통과시키고, 런타임에 실제 호출 시 에러가 나도록 둡니다.
  console.warn('Supabase 환경변수가 설정되지 않았습니다. .env.local을 확인하세요.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
