import { ref } from 'vue'
import { supabase } from '../lib/supabase'

// 앱 전체에서 하나만 쓰는 로그인 상태 (세션은 브라우저에 저장되어 자동 로그인됨)
const session = ref(null)
const ready = ref(false) // 저장된 세션 확인이 끝났는지

supabase.auth.getSession().then(({ data }) => {
  session.value = data.session
  ready.value = true
})
supabase.auth.onAuthStateChange((_event, s) => {
  session.value = s
  ready.value = true
})

export function useAuth() {
  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()
  return { session, ready, signIn, signOut }
}
