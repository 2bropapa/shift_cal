-- Supabase > SQL Editor 에서 실행 (하루 1칸 근무표 테이블)
create table if not exists public.schedule (
  work_date  date primary key,
  shift_type text not null check (shift_type in ('휴무','자출','DAY','SW','GY')),
  updated_at timestamptz not null default now()
);

alter table public.schedule enable row level security;

create policy "anon read"   on public.schedule for select to anon using (true);
create policy "anon insert" on public.schedule for insert to anon with check (true);
create policy "anon update" on public.schedule for update to anon using (true) with check (true);
create policy "anon delete" on public.schedule for delete to anon using (true);

alter publication supabase_realtime add table public.schedule;

-- 예전 테이블은 더 안 쓰므로 정리 (원하면 실행)
-- drop table if exists public.shifts;
