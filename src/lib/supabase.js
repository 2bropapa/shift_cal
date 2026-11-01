import { createClient } from '@supabase/supabase-js'

// VITE_ 접두사가 붙은 환경변수만 브라우저 코드에서 읽을 수 있음
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Supabase 환경변수가 없습니다. .env (로컬) 또는 Vercel 환경변수를 확인하세요.')
}

export const supabase = createClient(url, key)
