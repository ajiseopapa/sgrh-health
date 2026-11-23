-- 031 운동 알람 — 정해진 시간에 휴대폰(과 연결된 워치)으로 알림 보내기
-- ① exercise_reminders : 직원별 알람 설정(시간·요일·켜짐)
-- ② push_subscriptions : 알림을 받을 기기(브라우저가 발급한 주소)
-- 예약 실행(pg_cron)은 이 파일에 넣지 않습니다 — 비밀값이 들어가므로 별도 SQL로 실행합니다.
--
-- 되돌리기:
--   drop table if exists public.push_subscriptions;
--   drop table if exists public.exercise_reminders;

create table if not exists public.exercise_reminders (
  employee_id    uuid primary key references public.employees(id) on delete cascade,
  enabled        boolean not null default false,
  minute_of_day  smallint not null check (minute_of_day between 0 and 1430 and minute_of_day % 10 = 0), -- 한국 시간 기준, 10분 단위
  days           smallint[] not null default '{1,2,3,4,5}' check (days <@ array[0,1,2,3,4,5,6]::smallint[]), -- 0=일 … 6=토
  last_sent_date date,          -- 그날 이미 보냈으면 다시 보내지 않음
  updated_at     timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  endpoint    text not null unique,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_emp_idx on public.push_subscriptions(employee_id);

-- 접근: 서버만. RLS 켜고 정책 없음 + 공개 역할 권한 회수
do $$
declare t text;
begin
  foreach t in array array['exercise_reminders', 'push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('exercise_reminders', 'push_subscriptions')) as tables,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated')
     and table_name in ('exercise_reminders', 'push_subscriptions')) as public_grants;
