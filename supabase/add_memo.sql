-- 이미 schedule 테이블을 만든 경우: 메모 기능 추가용 (한 번만 실행)
alter table public.schedule add column if not exists memo text not null default '' check (char_length(memo) <= 100);
alter table public.schedule alter column shift_type drop not null;  -- 메모만 있는 날도 허용
