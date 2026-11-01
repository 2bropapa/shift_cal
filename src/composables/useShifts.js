import { ref, watch, onUnmounted } from 'vue'
import { supabase } from '../lib/supabase'

// 날짜를 'YYYY-MM-DD' 로 (toISOString 은 UTC 라 한국에서 하루 밀리므로 직접 포맷)
export const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * range: ref({ from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' })  화면에 보이는 기간
 * 기간이 바뀌면 다시 조회하고, 다른 사람의 변경은 실시간 반영
 */
export function useShifts(range) {
  const shifts = ref([])
  const loading = ref(false)
  const error = ref('')

  async function load() {
    loading.value = true
    error.value = ''
    const { data, error: e } = await supabase
      .from('shifts')
      .select('*')
      .gte('work_date', range.value.from)
      .lte('work_date', range.value.to)
      .order('created_at')
    if (e) error.value = e.message
    else shifts.value = data
    loading.value = false
  }

  async function addShift({ work_date, person, shift_type, memo }) {
    const { error: e } = await supabase
      .from('shifts')
      .insert({ work_date, person, shift_type, memo })
    if (e) error.value = e.message
  }

  async function removeShift(id) {
    const { error: e } = await supabase.from('shifts').delete().eq('id', id)
    if (e) error.value = e.message
  }

  // 실시간: 내가 한 변경도, 남이 한 변경도 같은 경로로 들어오므로 화면 반영 코드는 한 곳
  const inRange = (row) => row.work_date >= range.value.from && row.work_date <= range.value.to
  const channel = supabase
    .channel('shifts-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, (p) => {
      if (p.eventType === 'INSERT' && inRange(p.new) && !shifts.value.some((s) => s.id === p.new.id)) {
        shifts.value.push(p.new)
      } else if (p.eventType === 'UPDATE') {
        shifts.value = shifts.value.filter((s) => s.id !== p.new.id)
        if (inRange(p.new)) shifts.value.push(p.new)
      } else if (p.eventType === 'DELETE') {
        shifts.value = shifts.value.filter((s) => s.id !== p.old.id)
      }
    })
    .subscribe()

  onUnmounted(() => supabase.removeChannel(channel))

  watch(range, load, { immediate: true })

  return { shifts, loading, error, addShift, removeShift }
}
