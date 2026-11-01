import { ref, watch, onUnmounted } from 'vue'
import { supabase } from '../lib/supabase'

// 'YYYY-MM-DD' (toISOString 은 UTC 라 한국에서 하루 밀리므로 직접 포맷)
export const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * 하루 1칸 근무표. map = { 'YYYY-MM-DD': '자출' | '휴무' | ... }
 * range 가 바뀌면 재조회, 가족이 바꾼 내용은 실시간 반영
 */
export function useShifts(range) {
  const map = ref({})
  const loading = ref(false)
  const error = ref('')

  async function load() {
    loading.value = true
    error.value = ''
    const { data, error: e } = await supabase
      .from('schedule')
      .select('work_date, shift_type')
      .gte('work_date', range.value.from)
      .lte('work_date', range.value.to)
    if (e) error.value = e.message
    else map.value = Object.fromEntries(data.map((r) => [r.work_date, r.shift_type]))
    loading.value = false
  }

  // 화면에 즉시 반영 (type=null 이면 지움)
  function setLocal(date, type) {
    if (type) map.value[date] = type
    else delete map.value[date]
  }

  // DB에 한 번에 저장 (여러 날짜를 한 요청으로)
  async function commit(dates, type) {
    if (!dates.length) return
    let res
    if (type) {
      res = await supabase
        .from('schedule')
        .upsert(dates.map((d) => ({ work_date: d, shift_type: type, updated_at: new Date().toISOString() })))
    } else {
      res = await supabase.from('schedule').delete().in('work_date', dates)
    }
    if (res.error) {
      error.value = res.error.message
      load() // 실패 시 서버 상태로 되돌림
    }
  }

  const channel = supabase
    .channel('schedule-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, (p) => {
      if (p.eventType === 'DELETE') delete map.value[p.old.work_date]
      else map.value[p.new.work_date] = p.new.shift_type
    })
    .subscribe()

  onUnmounted(() => supabase.removeChannel(channel))
  watch(range, load, { immediate: true })

  return { map, loading, error, setLocal, commit }
}
