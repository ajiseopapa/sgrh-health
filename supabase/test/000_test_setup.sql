-- ============================================================
-- 000_test_setup.sql  — ⚠️ 시험용 Supabase 프로젝트 전용 (운영 DB에서 실행 금지)
--
-- 운영 DB가 지금 갖고 있을 것으로 보이는 구조(schema.sql + 마이그레이션 002~016)를
-- 한 번에 만들고, 가짜 직원·기록을 넣습니다.
-- 실행 후 018_pin_auth.sql 을 이어서 실행하세요.
-- ============================================================

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  employee_number text not null unique,
  color text,
  created_at timestamptz default now()
);

create table if not exists exercise_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text default '🏃',
  track_distance boolean not null default false
);

create table if not exists exercise_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  exercise_type_id uuid not null references exercise_types(id),
  log_date date not null default current_date,
  memo text,
  duration_minutes integer,
  distance_km numeric(6,2),
  duration_seconds integer,
  created_at timestamptz default now()
);
create index if not exists idx_logs_date on exercise_logs(log_date);
create index if not exists idx_logs_employee on exercise_logs(employee_id);

create table if not exists announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  created_at timestamptz default now() not null
);

create table if not exists employee_goals (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references employees(id) on delete cascade,
  year_month text not null,
  goal_count integer not null default 12,
  unique(employee_id, year_month)
);

create table if not exists suggestions (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references employees(id) on delete set null,
  employee_name text,
  title text not null,
  content text not null,
  status text not null default 'new' check (status in ('new', 'read', 'answered')),
  admin_reply text,
  created_at timestamptz default now() not null,
  replied_at timestamptz
);

create table if not exists log_reactions (
  id uuid default gen_random_uuid() primary key,
  log_id uuid not null references exercise_logs(id) on delete cascade,
  emoji text not null,
  device_id text,
  created_at timestamptz default now() not null
);
create index if not exists log_reactions_log_id_idx on log_reactions(log_id);
create unique index if not exists log_reactions_device_uniq on log_reactions(log_id, device_id, emoji);

-- 운영과 같은 "전부 열림" 정책 (전환 2의 019 차단 SQL을 시험하기 위해 똑같이 만듭니다)
do $$
declare t text;
begin
  foreach t in array array['employees','exercise_types','exercise_logs','announcements',
                           'employee_goals','suggestions','log_reactions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "test open select" on %I', t);
    execute format('drop policy if exists "test open insert" on %I', t);
    execute format('drop policy if exists "test open update" on %I', t);
    execute format('drop policy if exists "test open delete" on %I', t);
    execute format('create policy "test open select" on %I for select using (true)', t);
    execute format('create policy "test open insert" on %I for insert with check (true)', t);
    execute format('create policy "test open update" on %I for update using (true)', t);
    execute format('create policy "test open delete" on %I for delete using (true)', t);
  end loop;
end $$;

-- 가짜 데이터 (실제 직원 아님)
insert into exercise_types (name, icon, track_distance) values
  ('러닝', '🏃', true), ('걷기', '🚶', true), ('웨이트', '🏋️', false),
  ('요가', '🧘', false), ('자전거', '🚴', true), ('수영', '🏊', true)
on conflict do nothing;

insert into employees (name, employee_number) values
  ('시험직원가', 'T001'), ('시험직원나', 'T002'), ('시험직원다', 'T003'),
  ('시험직원라', 'T004'), ('시험직원마', 'T005')
on conflict do nothing;

-- 최근 20일 가짜 기록 (시간 없는 옛 기록도 일부 섞음)
insert into exercise_logs (employee_id, exercise_type_id, log_date, duration_seconds, duration_minutes, distance_km)
select e.id,
       (select id from exercise_types order by name limit 1 offset (g % 6)),
       (now() at time zone 'Asia/Seoul')::date - g,
       case when g % 5 = 0 then null else 1800 + g * 60 end,
       case when g % 5 = 0 then null else 30 + g end,
       null
from employees e
cross join generate_series(0, 19) g
where e.employee_number in ('T001', 'T002')
   or (e.employee_number = 'T003' and g % 3 = 0);

-- 확인: 직원 5, 종목 6, 기록 47 정도
select (select count(*) from employees) as employees,
       (select count(*) from exercise_types) as types,
       (select count(*) from exercise_logs) as logs;
