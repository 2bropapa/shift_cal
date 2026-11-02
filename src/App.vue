<script setup>
import { ref, computed } from 'vue'
import { useShifts, fmt } from './composables/useShifts'

// 근무 종류 / 색상
const TYPES = {
  자출: 'bg-sky-500 text-white',
  DAY: 'bg-amber-400 text-amber-950',
  SW: 'bg-orange-500 text-white',
  GY: 'bg-indigo-600 text-white',
  휴무: 'bg-rose-500 text-white',
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']

// 현재 브러시 (null = 지우개)
const brush = ref('자출')

// 달력
const cursor = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const todayStr = fmt(new Date())
const days = computed(() => {
  const y = cursor.value.getFullYear()
  const m = cursor.value.getMonth()
  const start = new Date(y, m, 1 - new Date(y, m, 1).getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { date: fmt(d), day: d.getDate(), inMonth: d.getMonth() === m, dow: d.getDay() }
  })
})
const range = computed(() => ({ from: days.value[0].date, to: days.value[41].date }))
const { map, loading, error, setLocal, commit } = useShifts(range)

const move = (n) => (cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + n, 1))
const goToday = () => (cursor.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1))

// 드래그로 칠하기
let painting = false
let touched = new Set()

function paint(date) {
  if (!date || touched.has(date)) return
  touched.add(date)
  setLocal(date, brush.value)
}
const dateAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-date]')?.dataset.date

function onDown(e) {
  const date = e.target.closest('[data-date]')?.dataset.date
  if (!date) return
  painting = true
  touched = new Set()
  paint(date)
}
function onMove(e) {
  if (painting) paint(dateAt(e.clientX, e.clientY))
}
async function onUp() {
  if (!painting) return
  painting = false
  const dates = [...touched]
  touched = new Set()
  await commit(dates, brush.value)
}

// 이번 달 비어있는 평일을 자출로 채우기
async function fillWeekdays() {
  const dates = days.value
    .filter((d) => d.inMonth && d.dow >= 1 && d.dow <= 5 && !map.value[d.date])
    .map((d) => d.date)
  dates.forEach((d) => setLocal(d, '자출'))
  await commit(dates, '자출')
}

// 이번 달 집계
const summary = computed(() => {
  const s = Object.fromEntries(Object.keys(TYPES).map((t) => [t, 0]))
  for (const d of days.value) if (d.inMonth && map.value[d.date]) s[map.value[d.date]]++
  return s
})
</script>

<template>
  <div class="mx-auto max-w-3xl select-none p-3 sm:p-6" @pointerup="onUp" @pointercancel="onUp">
    <!-- 월 이동 -->
    <header class="mb-3 flex items-center gap-2">
      <button class="nav" @click="move(-1)">‹</button>
      <h1 class="min-w-32 text-center text-xl font-bold text-slate-800">
        {{ cursor.getFullYear() }}년 {{ cursor.getMonth() + 1 }}월
      </h1>
      <button class="nav" @click="move(1)">›</button>
      <button class="nav px-3 text-sm" @click="goToday">오늘</button>
      <span class="w-4 text-xs text-slate-400">{{ loading ? '…' : '' }}</span>
      <button class="ml-auto rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white" @click="fillWeekdays">
        평일 자출 채우기
      </button>
    </header>

    <!-- 에러는 화면 위에 띄워서 달력 위치가 밀리지 않게 -->
    <p v-if="error" class="fixed inset-x-3 bottom-3 z-20 rounded-lg bg-red-600 p-3 text-sm text-white shadow-lg">⚠ {{ error }}</p>

    <!-- 브러시 팔레트 -->
    <div class="sticky top-0 z-10 -mx-1 mb-3 flex gap-1.5 bg-slate-50/95 px-1 py-2">
      <button
        v-for="(c, t) in TYPES"
        :key="t"
        class="flex-1 rounded-xl py-2.5 text-sm font-bold transition"
        :class="brush === t ? c + ' scale-105 shadow-lg ring-4 ring-slate-300' : 'bg-white text-slate-500 ring-1 ring-slate-200'"
        @click="brush = t"
      >{{ t }}</button>
      <button
        class="w-14 rounded-xl py-2.5 text-sm font-bold transition"
        :class="brush === null ? 'bg-slate-700 text-white shadow-lg ring-4 ring-slate-300' : 'bg-white text-slate-500 ring-1 ring-slate-200'"
        @click="brush = null"
      >지움</button>
    </div>

    <!-- 달력 -->
    <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium">
        <div v-for="(w, i) in DOW" :key="w" class="py-2" :class="i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'">{{ w }}</div>
      </div>
      <div class="grid grid-cols-7" style="touch-action: none" @pointerdown="onDown" @pointermove="onMove">
        <div
          v-for="d in days"
          :key="d.date"
          :data-date="d.date"
          class="flex h-16 cursor-pointer flex-col items-center justify-start gap-1 border-b border-r border-slate-100 pt-1 sm:h-20"
          :class="d.inMonth ? '' : 'opacity-35'"
        >
          <span
            class="pointer-events-none flex h-6 w-6 items-center justify-center rounded-full text-xs"
            :class="[
              d.date === todayStr ? 'bg-slate-800 font-bold text-white' : '',
              d.dow === 0 ? 'text-red-500' : d.dow === 6 ? 'text-blue-500' : 'text-slate-700',
            ]"
          >{{ d.day }}</span>
          <span
            v-if="map[d.date]"
            class="pointer-events-none w-[86%] rounded-md py-0.5 text-center text-[11px] font-bold sm:text-xs"
            :class="TYPES[map[d.date]]"
          >{{ map[d.date] }}</span>
        </div>
      </div>
    </div>

    <!-- 집계 -->
    <div class="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
      <span v-for="(n, t) in summary" :key="t" class="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
        {{ t }} <b>{{ n }}</b>일
      </span>
    </div>
    <p class="mt-3 text-xs text-slate-400">위에서 종류를 고르고 → 날짜를 누르거나 드래그해서 칠하세요.</p>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.nav {
  @apply rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100;
}
</style>
