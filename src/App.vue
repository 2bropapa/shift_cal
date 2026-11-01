<script setup>
import { ref, computed, watch } from 'vue'
import { useShifts, fmt } from './composables/useShifts'

// ── 근무 종류 (색상) ─────────────────────────────
const TYPES = {
  주간: 'bg-sky-100 text-sky-800',
  야간: 'bg-indigo-100 text-indigo-800',
  휴무: 'bg-slate-200 text-slate-600',
  연차: 'bg-amber-100 text-amber-800',
  기타: 'bg-emerald-100 text-emerald-800',
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']

// ── 내 이름 (브라우저에 기억) ───────────────────
const myName = ref(localStorage.getItem('myName') || '')
watch(myName, (v) => localStorage.setItem('myName', v))

// ── 달력 계산 ────────────────────────────────────
const cursor = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const todayStr = fmt(new Date())

const days = computed(() => {
  const y = cursor.value.getFullYear()
  const m = cursor.value.getMonth()
  const start = new Date(y, m, 1 - new Date(y, m, 1).getDay()) // 1일이 속한 주의 일요일
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { date: fmt(d), day: d.getDate(), inMonth: d.getMonth() === m, dow: d.getDay() }
  })
})

const range = computed(() => ({ from: days.value[0].date, to: days.value[41].date }))
const { shifts, loading, error, addShift, removeShift } = useShifts(range)

const byDate = computed(() => {
  const map = {}
  for (const s of shifts.value) (map[s.work_date] ||= []).push(s)
  return map
})

const move = (n) => (cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + n, 1))
const goToday = () => (cursor.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1))

// ── 입력 모달 ────────────────────────────────────
const selected = ref(null) // 'YYYY-MM-DD'
const form = ref({ person: '', shift_type: '주간', memo: '' })

function openDay(date) {
  selected.value = date
  form.value = { person: myName.value, shift_type: '주간', memo: '' }
}

async function submit() {
  const person = form.value.person.trim()
  if (!person) return
  myName.value = person
  await addShift({ work_date: selected.value, person, shift_type: form.value.shift_type, memo: form.value.memo.trim() })
}

const selectedLabel = computed(() => {
  if (!selected.value) return ''
  const d = new Date(selected.value + 'T00:00:00')
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`
})
</script>

<template>
  <div class="mx-auto max-w-5xl p-3 sm:p-6">
    <!-- 헤더 -->
    <header class="mb-4 flex flex-wrap items-center gap-2">
      <h1 class="text-xl font-bold text-slate-800">
        {{ cursor.getFullYear() }}년 {{ cursor.getMonth() + 1 }}월
      </h1>
      <div class="flex gap-1">
        <button class="btn" @click="move(-1)">‹</button>
        <button class="btn" @click="goToday">오늘</button>
        <button class="btn" @click="move(1)">›</button>
      </div>
      <span v-if="loading" class="text-xs text-slate-400">불러오는 중…</span>
      <div class="ml-auto flex items-center gap-2 text-sm">
        <label class="text-slate-500">내 이름</label>
        <input v-model="myName" maxlength="20" placeholder="이름" class="w-28 rounded border border-slate-300 px-2 py-1" />
      </div>
    </header>

    <p v-if="error" class="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">⚠ {{ error }}</p>

    <!-- 범례 -->
    <div class="mb-2 flex flex-wrap gap-1.5 text-xs">
      <span v-for="(c, t) in TYPES" :key="t" class="rounded px-2 py-0.5" :class="c">{{ t }}</span>
    </div>

    <!-- 달력 -->
    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium">
        <div v-for="(w, i) in DOW" :key="w" class="py-2" :class="i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'">{{ w }}</div>
      </div>
      <div class="grid grid-cols-7">
        <button
          v-for="d in days"
          :key="d.date"
          class="min-h-20 border-b border-r border-slate-100 p-1 text-left align-top transition hover:bg-slate-50 sm:min-h-28"
          :class="{ 'bg-slate-50/60': !d.inMonth }"
          @click="openDay(d.date)"
        >
          <span
            class="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs"
            :class="[
              d.date === todayStr ? 'bg-sky-600 font-bold text-white' : '',
              !d.inMonth ? 'text-slate-300' : d.dow === 0 ? 'text-red-500' : d.dow === 6 ? 'text-blue-500' : 'text-slate-700',
            ]"
          >{{ d.day }}</span>
          <div class="space-y-0.5">
            <div
              v-for="s in byDate[d.date] || []"
              :key="s.id"
              class="truncate rounded px-1 text-[11px] leading-5"
              :class="[TYPES[s.shift_type] || TYPES.기타, s.person === myName ? 'ring-1 ring-slate-500' : '']"
              :title="s.memo"
            >{{ s.person }} · {{ s.shift_type }}</div>
          </div>
        </button>
      </div>
    </div>

    <!-- 모달 -->
    <div v-if="selected" class="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4" @click.self="selected = null">
      <div class="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-bold text-slate-800">{{ selectedLabel }}</h2>
          <button class="text-slate-400 hover:text-slate-700" @click="selected = null">✕</button>
        </div>

        <ul class="mb-3 space-y-1">
          <li v-for="s in byDate[selected] || []" :key="s.id" class="flex items-center gap-2 rounded px-2 py-1 text-sm" :class="TYPES[s.shift_type] || TYPES.기타">
            <span class="font-medium">{{ s.person }}</span>
            <span>{{ s.shift_type }}</span>
            <span class="truncate text-xs opacity-70">{{ s.memo }}</span>
            <button class="ml-auto text-xs opacity-60 hover:opacity-100" @click="removeShift(s.id)">삭제</button>
          </li>
          <li v-if="!(byDate[selected] || []).length" class="text-sm text-slate-400">등록된 근무가 없습니다.</li>
        </ul>

        <form class="space-y-2 border-t border-slate-100 pt-3" @submit.prevent="submit">
          <input v-model="form.person" maxlength="20" placeholder="이름" required class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <div class="flex flex-wrap gap-1">
            <button
              v-for="(c, t) in TYPES"
              :key="t"
              type="button"
              class="rounded px-2.5 py-1 text-xs"
              :class="form.shift_type === t ? c + ' ring-2 ring-slate-500' : 'bg-slate-100 text-slate-500'"
              @click="form.shift_type = t"
            >{{ t }}</button>
          </div>
          <input v-model="form.memo" maxlength="100" placeholder="메모 (선택)" class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <button class="w-full rounded bg-sky-600 py-1.5 text-sm font-medium text-white hover:bg-sky-700">근무 추가</button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.btn {
  @apply rounded border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-100;
}
</style>
