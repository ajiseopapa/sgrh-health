-- ============================================
-- 직원 운동 관리 프로그램 DB 스키마
-- Supabase SQL Editor에서 그대로 실행하세요.
-- ============================================

-- 직원 테이블
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  employee_number text unique,
  created_at timestamptz default now()
);

-- 운동 종목 테이블
create table if not exists exercise_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text default '🏃'
);

-- 운동 기록 테이블
create table if not exists exercise_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  exercise_type_id uuid not null references exercise_types(id),
  log_date date not null default current_date,
  memo text,
  created_at timestamptz default now()
);

create index if not exists idx_logs_date on exercise_logs(log_date);
create index if not exists idx_logs_employee on exercise_logs(employee_id);

-- 운동 종목 샘플 데이터 (필요에 맞게 수정하세요)
insert into exercise_types (name, icon) values
  ('러닝', '🏃'),
  ('웨이트', '🏋️'),
  ('요가', '🧘'),
  ('자전거', '🚴'),
  ('수영', '🏊')
on conflict do nothing;

-- 직원 샘플 데이터 (실제 팀원 이름/사번으로 교체하세요)
insert into employees (name, employee_number) values
  ('김민준', '1001'), ('이서연', '1002'), ('박지호', '1003')
on conflict do nothing;

-- ============================================
-- RLS (Row Level Security)
-- 로그인 없는 내부용 툴이라 anon 키로 읽기/쓰기를 허용합니다.
-- 외부에 공개되는 서비스라면 더 엄격한 정책이 필요합니다.
-- ============================================
alter table employees enable row level security;
alter table exercise_types enable row level security;
alter table exercise_logs enable row level security;

drop policy if exists "anon read employees" on employees;
create policy "anon read employees" on employees for select using (true);
drop policy if exists "anon insert employees" on employees;
create policy "anon insert employees" on employees for insert with check (true);
drop policy if exists "anon update employees" on employees;
create policy "anon update employees" on employees for update using (true);
drop policy if exists "anon delete employees" on employees;
create policy "anon delete employees" on employees for delete using (true);

drop policy if exists "anon read types" on exercise_types;
create policy "anon read types" on exercise_types for select using (true);
drop policy if exists "anon insert types" on exercise_types;
create policy "anon insert types" on exercise_types for insert with check (true);
drop policy if exists "anon update types" on exercise_types;
create policy "anon update types" on exercise_types for update using (true);
drop policy if exists "anon delete types" on exercise_types;
create policy "anon delete types" on exercise_types for delete using (true);

drop policy if exists "anon read logs" on exercise_logs;
create policy "anon read logs" on exercise_logs for select using (true);
drop policy if exists "anon insert logs" on exercise_logs;
create policy "anon insert logs" on exercise_logs for insert with check (true);
