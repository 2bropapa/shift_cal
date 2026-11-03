-- 로그인한 사용자만 접근하도록 잠그기
-- ※ 새 앱을 배포하고 로그인이 되는 것을 확인한 뒤에 실행하세요.

-- 1) 기존 '누구나' 정책 삭제
drop policy if exists "anon read"   on public.schedule;
drop policy if exists "anon insert" on public.schedule;
drop policy if exists "anon update" on public.schedule;
drop policy if exists "anon delete" on public.schedule;

-- 2) 로그인한 사용자(authenticated)만 허용
create policy "auth read"   on public.schedule for select to authenticated using (true);
create policy "auth insert" on public.schedule for insert to authenticated with check (true);
create policy "auth update" on public.schedule for update to authenticated using (true) with check (true);
create policy "auth delete" on public.schedule for delete to authenticated using (true);

-- 3) 예전 실습용 테이블(누구나 접근 가능)은 삭제
drop table if exists public.shifts;
