-- Supabase > SQL Editor 에 통째로 붙여넣고 Run

-- 1) 테이블
create table if not exists public.shifts (
  id         uuid primary key default gen_random_uuid(),
  work_date  date not null,
  person     text not null check (char_length(person) between 1 and 20),
  shift_type text not null default '주간',
  memo       text default '' check (char_length(memo) <= 100),
  created_at timestamptz not null default now()
);

create index if not exists shifts_work_date_idx on public.shifts (work_date);

-- 2) RLS (Row Level Security) 켜기 — 켜면 정책이 없는 한 아무도 접근 못 함
alter table public.shifts enable row level security;

-- 3) 정책: 로그인 없이(anon) 누구나 조회/추가/수정/삭제
--    ※ 학습용. 실서비스에서는 auth.uid() 기반으로 좁혀야 함 (GUIDE.md 7장)
create policy "anyone can read"   on public.shifts for select to anon using (true);
create policy "anyone can insert" on public.shifts for insert to anon with check (true);
create policy "anyone can update" on public.shifts for update to anon using (true) with check (true);
create policy "anyone can delete" on public.shifts for delete to anon using (true);

-- 4) 실시간(Realtime) 구독 허용
alter publication supabase_realtime add table public.shifts;
