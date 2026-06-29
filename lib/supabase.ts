import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 환경변수가 없을 때 빌드가 깨지지 않도록 방어 로직 추가
let supabase: any;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('경고: Supabase 환경변수가 설정되지 않았습니다.');
  // 빈 객체로 초기화하여 에러 발생 방지
  supabase = {
    from: () => ({ select: () => Promise.resolve({ data: [], error: null }) })
  };
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };