<script setup>
import { ref, computed, nextTick } from 'vue'
import { useShifts, fmt } from './composables/useShifts'
import { HOLIDAYS } from './lib/holidays'

// 근무 종류 / 색상
const TYPES = {
  자출: 'bg-sky-500 text-white',
  DAY: 'bg-amber-400 text-amber-950',
  SW: 'bg-orange-500 text-white',
  GY: 'bg-indigo-600 text-white',
  휴무: 'bg-rose-500 text-white',
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const MEMO = '메모' // 브러시 값: 근무 종류 / null(지우개) / MEMO(메모 입력) / VIEW(보기·스와이프)
const VIEW = '보기'

const brush = ref(VIEW)

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
const { rows, loading, error, setLocal, commit, saveMemo } = useShifts(range)
const typeOf = (date) => rows.value[date]?.shift_type || null

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

// 보기 모드: 좌우 스와이프로 월 이동 (왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 이전 달)
let swipe = null
function onRootDown(e) {
  if (brush.value === VIEW) swipe = { x: e.clientX, y: e.clientY }
}

function onDown(e) {
  if (brush.value === VIEW) return
  const date = e.target.closest('[data-date]')?.dataset.date
  if (!date) return
  if (brush.value === MEMO) return openMemo(date) // 메모 모드: 입력창 열기
  painting = true
  touched = new Set()
  paint(date)
}
function onMove(e) {
  if (painting) paint(dateAt(e.clientX, e.clientY))
}
async function onUp(e) {
  if (swipe) {
    const dx = e.clientX - swipe.x
    const dy = e.clientY - swipe.y
    swipe = null
    if (e.type === 'pointerup' && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1)
    return
  }
  if (!painting) return
  painting = false
  const dates = [...touched]
  touched = new Set()
  await commit(dates, brush.value)
}

// 이번 달 비어있는 평일을 자출로 채우기
async function fillWeekdays() {
  const dates = days.value
    .filter((d) => d.inMonth && d.dow >= 1 && d.dow <= 5 && !typeOf(d.date))
    .map((d) => d.date)
  dates.forEach((d) => setLocal(d, '자출'))
  await commit(dates, '자출')
}

// 메모 입력창
const memoDate = ref(null)
const memoText = ref('')
const memoInput = ref(null)
const memoLabel = computed(() => {
  if (!memoDate.value) return ''
  const d = new Date(memoDate.value + 'T00:00:00')
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`
})
function openMemo(date) {
  memoDate.value = date
  memoText.value = rows.value[date]?.memo || ''
  nextTick(() => memoInput.value?.focus())
}
async function submitMemo(clear = false) {
  const date = memoDate.value
  const text = clear ? '' : memoText.value.trim()
  memoDate.value = null
  await saveMemo(date, text)
}

// 이번 달 집계
const summary = computed(() => {
  const s = Object.fromEntries(Object.keys(TYPES).map((t) => [t, 0]))
  for (const d of days.value) if (d.inMonth && typeOf(d.date)) s[typeOf(d.date)]++
  return s
})
</script>

<template>
  <div
    class="mx-auto min-h-screen max-w-3xl select-none p-3 sm:p-6"
    :style="{ touchAction: brush === VIEW ? 'pan-y' : 'auto' }"
    @pointerdown="onRootDown"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
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
    <div class="sticky top-0 z-10 -mx-1 mb-3 flex gap-1 bg-slate-50/95 px-1 py-2">
      <button
        class="min-w-0 flex-1 rounded-xl py-2.5 text-xs font-bold transition sm:text-sm"
        :class="brush === VIEW ? 'bg-slate-800 text-white shadow-lg ring-4 ring-slate-300' : 'bg-white text-slate-500 ring-1 ring-slate-200'"
        @click="brush = VIEW"
      >보기</button>
      <button
        v-for="(c, t) in TYPES"
        :key="t"
        class="min-w-0 flex-1 rounded-xl py-2.5 text-xs font-bold transition sm:text-sm"
        :class="brush === t ? c + ' scale-105 shadow-lg ring-4 ring-slate-300' : 'bg-white text-slate-500 ring-1 ring-slate-200'"
        @click="brush = t"
      >{{ t }}</button>
      <button
        class="min-w-0 flex-1 rounded-xl py-2.5 text-xs font-bold transition sm:text-sm"
        :class="brush === MEMO ? 'bg-emerald-600 text-white shadow-lg ring-4 ring-slate-300' : 'bg-white text-emerald-700 ring-1 ring-emerald-200'"
        @click="brush = MEMO"
      >메모</button>
      <button
        class="min-w-0 flex-1 rounded-xl py-2.5 text-xs font-bold transition sm:text-sm"
        :class="brush === null ? 'bg-slate-700 text-white shadow-lg ring-4 ring-slate-300' : 'bg-white text-slate-500 ring-1 ring-slate-200'"
        @click="brush = null"
      >지움</button>
    </div>

    <!-- 달력 -->
    <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium">
        <div v-for="(w, i) in DOW" :key="w" class="py-2" :class="i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'">{{ w }}</div>
      </div>
      <div class="grid grid-cols-7" :style="{ touchAction: brush === VIEW ? 'pan-y' : 'none' }" @pointerdown="onDown" @pointermove="onMove">
        <div
          v-for="d in days"
          :key="d.date"
          :data-date="d.date"
          class="flex h-24 cursor-pointer flex-col items-center justify-start gap-0.5 overflow-hidden border-b border-r border-slate-100 pt-1 sm:h-28"
          :class="[d.inMonth ? '' : 'opacity-35', HOLIDAYS[d.date] ? 'bg-red-50/60' : '']"
        >
          <span
            class="pointer-events-none flex h-6 w-6 items-center justify-center rounded-full text-xs"
            :class="[
              d.date === todayStr ? 'bg-slate-800 font-bold text-white' : '',
              d.date === todayStr ? '' : HOLIDAYS[d.date] || d.dow === 0 ? 'text-red-500' : d.dow === 6 ? 'text-blue-500' : 'text-slate-700',
            ]"
          >{{ d.day }}</span>
          <span class="pointer-events-none h-3 w-full truncate text-center text-[9px] leading-3 text-red-500 sm:text-[10px]">{{ HOLIDAYS[d.date] || '' }}</span>
          <span
            v-if="typeOf(d.date)"
            class="pointer-events-none w-[86%] rounded-md py-0.5 text-center text-[11px] font-bold sm:text-xs"
            :class="TYPES[typeOf(d.date)]"
          >{{ typeOf(d.date) }}</span>
          <span
            v-if="rows[d.date]?.memo"
            class="pointer-events-none line-clamp-2 w-full break-all px-0.5 text-center text-[10px] leading-tight text-emerald-700"
          >{{ rows[d.date].memo }}</span>
        </div>
      </div>
    </div>

    <!-- 집계 -->
    <div class="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
      <span v-for="(n, t) in summary" :key="t" class="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
        {{ t }} <b>{{ n }}</b>일
      </span>
    </div>
    <p class="mt-3 text-xs text-slate-400">「보기」에서는 좌우로 밀어 달이 바뀝니다. 입력하려면 종류를 고르고 날짜를 누르거나 드래그하세요. 「메모」는 날짜를 누르면 쓸 수 있어요.</p>

    <!-- 메모 입력창 -->
    <div v-if="memoDate" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" @click.self="memoDate = null">
      <form class="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl" @submit.prevent="submitMemo()">
        <h2 class="mb-2 font-bold text-slate-800">{{ memoLabel }} 메모</h2>
        <input
          ref="memoInput"
          v-model="memoText"
          maxlength="100"
          placeholder="예) 병원, 아이 학교 행사"
          class="w-full rounded border border-slate-300 px-2 py-2 text-sm select-text"
        />
        <div class="mt-3 flex gap-2">
          <button type="button" class="rounded-lg px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200" @click="submitMemo(true)">삭제</button>
          <button type="button" class="ml-auto rounded-lg px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-200" @click="memoDate = null">취소</button>
          <button class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">저장</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.nav {
  @apply rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100;
}
</style>
