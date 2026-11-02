import { ref, watch, onUnmounted } from 'vue'
import { supabase } from '../lib/supabase'

// 'YYYY-MM-DD' (toISOString 은 UTC 라 한국에서 하루 밀리므로 직접 포맷)
export const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * 하루 1칸 근무표. rows = { 'YYYY-MM-DD': { shift_type: '자출' | null, memo: '' } }
 * range 가 바뀌면 재조회, 가족이 바꾼 내용은 실시간 반영
 */
export function useShifts(range) {
  const rows = ref({})
  const loading = ref(false)
  const error = ref('')
  const now = () => new Date().toISOString()

  async function load() {
    loading.value = true
    const { data, error: e } = await supabase
      .from('schedule')
      .select('work_date, shift_type, memo')
      .gte('work_date', range.value.from)
      .lte('work_date', range.value.to)
    if (e) error.value = e.message
    else {
      error.value = ''
      rows.value = Object.fromEntries(
        data.map((r) => [r.work_date, { shift_type: r.shift_type, memo: r.memo || '' }]),
      )
    }
    loading.value = false
  }

  // 화면에 즉시 반영 (type=null 이면 근무만 지움, 메모는 유지)
  function setLocal(date, type) {
    const cur = rows.value[date] || { shift_type: null, memo: '' }
    const next = { ...cur, shift_type: type }
    if (!next.shift_type && !next.memo) delete rows.value[date]
    else rows.value[date] = next
  }

  // 근무 종류 저장 (여러 날짜를 한 요청으로)
  async function commit(dates, type) {
    if (!dates.length) return
    let res
    if (type) {
      res = await supabase
        .from('schedule')
        .upsert(dates.map((d) => ({ work_date: d, shift_type: type, updated_at: now() })))
    } else {
      res = await supabase.from('schedule').update({ shift_type: null, updated_at: now() }).in('work_date', dates)
      // 근무도 메모도 없는 빈 행은 정리
      if (!res.error)
        res = await supabase.from('schedule').delete().in('work_date', dates).is('shift_type', null).eq('memo', '')
    }
    if (res.error) {
      error.value = res.error.message
      load() // 실패 시 서버 상태로 되돌림
    }
  }

  // 메모 저장 (빈 문자열이면 메모 삭제)
  async function saveMemo(date, memo) {
    const cur = rows.value[date]
    const type = cur?.shift_type ?? null
    if (!type && !memo) delete rows.value[date]
    else rows.value[date] = { shift_type: type, memo }

    let res
    if (memo) res = await supabase.from('schedule').upsert({ work_date: date, memo, updated_at: now() })
    else if (type) res = await supabase.from('schedule').update({ memo: '', updated_at: now() }).eq('work_date', date)
    else res = await supabase.from('schedule').delete().eq('work_date', date)

    if (res.error) {
      error.value = res.error.message
      load()
    }
  }

  const channel = supabase
    .channel('schedule-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, (p) => {
      if (p.eventType === 'DELETE') {
        delete rows.value[p.old.work_date]
      } else {
        const { work_date, shift_type, memo } = p.new
        if (!shift_type && !memo) delete rows.value[work_date]
        else rows.value[work_date] = { shift_type, memo: memo || '' }
      }
    })
    .subscribe()

  onUnmounted(() => supabase.removeChannel(channel))
  watch(range, load, { immediate: true })

  return { rows, loading, error, setLocal, commit, saveMemo }
}
