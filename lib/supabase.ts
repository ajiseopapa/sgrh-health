import { createClient } from '@supabase/supabase-js'

// '!'를 제거하고 기본값을 빈 문자열로 처리하여 빌드 시 오류를 방지합니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 환경변수가 없으면 개발자에게 경고만 하고 빌드는 중단시키지 않습니다.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('경고: Supabase 환경변수가 설정되지 않았습니다.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)