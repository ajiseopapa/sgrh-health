-- ============================================================
-- 024_v21_engagement.sql — v2.1 참여 기능: 부서·퇴사·개인 목표·챌린지·배지
-- ⚠️ 시험 DB 전용. 운영 실행은 PM 승인 뒤. 여러 번 실행해도 결과 같음.
--
-- 원칙
--  · 운동 기록(exercise_logs)은 그대로 쓰고 새로 복사·저장하지 않습니다. 진행률·순위는 모두 기록에서 계산.
--  · 기존 테이블·데이터는 바꾸지 않습니다. employees 에 칸 1개(left_at)만 추가합니다.
--  · 새 테이블은 서버(service_role)만 접근: RLS 켜고 정책 없음 + 공개 역할 권한 회수(023과 같은 방식).
--  · 기존 employee_goals(월 단위 횟수, 운영 0건)는 그대로 둡니다. 주간 횟수·시간 목표와 변경 이력이
--    필요해 personal_goals 를 새로 만듭니다.
--  · 새 테이블의 직원 참조는 on delete cascade: "직원 삭제"는 잘못 등록한 직원을 지우는 기능이고,
--    퇴사는 삭제 대신 left_at 으로 표시해 기록·부서 이력을 보존합니다.
-- ============================================================

-- 1) 퇴사일 (마지막 근무일, 없으면 재직). 퇴사자는 로그인·이름 목록·분모에서 빠지고 기록은 남습니다.
alter table public.employees add column if not exists left_at date;

-- 2) 부서
create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(name) between 1 and 30),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- 3) 부서별 인사팀 확인 인원 (월 단위). 없으면 그 달 참여율은 "인원 정보 없음"
create table if not exists public.department_headcounts (
  department_id uuid not null references public.departments(id) on delete cascade,
  year_month    text not null check (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  headcount     integer not null check (headcount between 1 and 10000),
  source        text check (char_length(source) <= 60),   -- 예: '인사팀 11월 인원 현황'
  updated_at    timestamptz not null default now(),
  primary key (department_id, year_month)
);

-- 4) 직원 부서 이력. [start_date, end_date) 기간에 그 부서. end_date 가 없으면 현재 부서.
create table if not exists public.employee_departments (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  start_date    date not null,
  end_date      date,
  created_at    timestamptz not null default now(),
  check (end_date is null or end_date > start_date)
);
create unique index if not exists employee_departments_one_open
  on public.employee_departments(employee_id) where end_date is null;
create index if not exists employee_departments_emp_idx on public.employee_departments(employee_id, start_date);

-- 5) 개인 주간 목표. 바꿀 때마다 그 주 월요일(effective_from) 기준으로 한 줄. 과거 주는 그때 목표로 판정
create table if not exists public.personal_goals (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees(id) on delete cascade,
  kind           text not null check (kind in ('sessions', 'minutes')),
  target         integer not null check (target between 1 and 2100),
  effective_from date not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (employee_id, effective_from),
  check ((kind = 'sessions' and target <= 21) or (kind = 'minutes' and target between 10 and 2100))
);

-- 6) 챌린지 (관리자 생성). metric: 운동 횟수 / 인정 운동 시간(분) / 활동일
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 40),
  description text check (char_length(description) <= 200),
  metric      text not null check (metric in ('sessions', 'minutes', 'active_days')),
  target      integer not null check (target between 1 and 100000),
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, employee_id)
);

-- 7) 배지. 같은 직원·같은 배지는 1번만 (기본키)
create table if not exists public.employee_badges (
  employee_id uuid not null references public.employees(id) on delete cascade,
  badge_key   text not null check (badge_key ~ '^[a-z_]+_[0-9]+$'),
  awarded_at  timestamptz not null default now(),
  primary key (employee_id, badge_key)
);

-- 8) 접근: 서버만. RLS 켜고 정책 없음 + 공개 역할 권한 회수
do $$
declare t text;
begin
  foreach t in array array['departments', 'department_headcounts', 'employee_departments',
                           'personal_goals', 'challenges', 'challenge_participants', 'employee_badges'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 9) 달력 분모(021)에서 퇴사자 제외: 그날 재직 중(등록일 ≤ 그날 ≤ 퇴사일)인 직원만
create or replace function calendar_headcount(p_day date)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'count', nullif(count(*)::int, 0),
    'basis', 'registered'
  )
  from employees e
  where e.created_at < ((p_day + 1)::timestamp at time zone 'Asia/Seoul')
    and (e.left_at is null or e.left_at >= p_day)
$$;

-- ── 확인 쿼리: 새 테이블 7개 RLS on·정책 0·공개 권한 없음, left_at 칸 있음 ──
select
  (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relrowsecurity
     and relname in ('departments','department_headcounts','employee_departments','personal_goals','challenges','challenge_participants','employee_badges')) as rls_tables,
  (select count(*) from pg_policies where schemaname = 'public'
     and tablename in ('departments','department_headcounts','employee_departments','personal_goals','challenges','challenge_participants','employee_badges')) as policies,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated')
     and table_name in ('departments','department_headcounts','employee_departments','personal_goals','challenges','challenge_participants','employee_badges')) as public_grants,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'employees' and column_name = 'left_at') as left_at_col;

-- ── 되돌리기 (새 테이블에 쌓인 목표·챌린지·배지·부서 자료가 사라짐에 주의) ──
-- 1) 021_calendar_headcount.sql 의 calendar_headcount 정의를 다시 실행
-- 2) drop table if exists public.employee_badges, public.challenge_participants, public.challenges,
--      public.personal_goals, public.employee_departments, public.department_headcounts, public.departments;
-- 3) alter table public.employees drop column if exists left_at;   -- 퇴사 표시가 사라짐
