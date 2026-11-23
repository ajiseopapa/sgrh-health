-- ============================================================
-- 018_pin_auth.sql — 직원 PIN 본인 확인 + 감사 로그 (v2 전환 1)
-- 실행 순서: 017(백업) → 018
--
-- 새 테이블 3개를 만들고, 기존 테이블에는 컬럼 1개만 추가합니다. 기존 데이터는 바뀌지 않습니다.
-- 새 테이블은 정책을 만들지 않아 브라우저(공개 키)에서는 읽기·쓰기 모두 막힙니다.
-- 서버(service_role 키)만 접근합니다.
-- ============================================================

-- 1) 직원 PIN (원문 저장 안 함, 해시만)
create table if not exists employee_pins (
  employee_id   uuid primary key references employees(id) on delete cascade,
  pin_hash      text not null,
  is_temp       boolean not null default true,   -- 관리자가 발급한 임시 PIN이면 true
  failed_count  integer not null default 0,
  locked_until  timestamptz,
  updated_at    timestamptz not null default now()
);
alter table employee_pins enable row level security;

-- 2) 로그인 세션 (쿠키에는 무작위 토큰, DB에는 그 해시만)
create table if not exists auth_sessions (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique,
  role          text not null check (role in ('employee', 'admin')),
  employee_id   uuid references employees(id) on delete cascade,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_seen_at  timestamptz not null default now()
);
create index if not exists auth_sessions_employee_idx on auth_sessions(employee_id);
alter table auth_sessions enable row level security;

-- 3) 감사 로그
create table if not exists audit_logs (
  id                 uuid primary key default gen_random_uuid(),
  table_name         text not null,
  record_id          text,
  action             text not null check (action in ('insert', 'update', 'delete')),
  actor_type         text not null check (actor_type in ('employee', 'admin', 'system')),
  actor_employee_id  uuid,
  before_data        jsonb,
  after_data         jsonb,
  created_at         timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on audit_logs(created_at desc);
alter table audit_logs enable row level security;

-- 4) 같은 요청 두 번 저장 방지용 요청 번호 (기존 기록은 비어 있음)
alter table exercise_logs add column if not exists client_request_id text;
create unique index if not exists exercise_logs_client_request_uniq
  on exercise_logs(client_request_id) where client_request_id is not null;

-- 5) 요청 제한 (IP·직원별 로그인 시도 횟수). IP는 원문이 아니라 해시로만 저장합니다.
create table if not exists rate_limits (
  bucket        text primary key,
  window_start  timestamptz not null default now(),
  hits          integer not null default 0
);
alter table rate_limits enable row level security;

-- 한 번의 호출로 "횟수 올리고, 한도 안인지" 판단 (동시에 여러 요청이 와도 정확하게)
create or replace function hit_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_hits integer;
begin
  insert into rate_limits as r (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;
revoke all on function hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function hit_rate_limit(text, integer, integer) to service_role;

-- 6) 개인 목표는 본인만 보도록 브라우저 접근을 닫습니다
--    (지금 화면에서 쓰지 않는 테이블이라 영향 없음. 서버가 본인 것만 돌려줌)
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'employee_goals' loop
    execute format('drop policy %I on employee_goals', p.policyname);
  end loop;
end $$;

-- ── 확인 쿼리 ──
-- ① 새 테이블 3개가 보이고, 정책 수가 0이어야 합니다
select t.tablename, (select count(*) from pg_policies p where p.tablename = t.tablename) as 정책수
from pg_tables t
where t.schemaname = 'public' and t.tablename in ('employee_pins', 'auth_sessions', 'audit_logs', 'rate_limits', 'employee_goals')
order by 1;
-- ② 기존 기록 수가 017 백업과 같아야 합니다
select count(*) as 기록수 from exercise_logs;

-- ── 되돌리기 ──
-- drop function if exists hit_rate_limit(text, integer, integer);
-- drop table if exists employee_pins, auth_sessions, audit_logs, rate_limits;
-- drop index if exists exercise_logs_client_request_uniq;
-- alter table exercise_logs drop column if exists client_request_id;
-- create policy "goals_select" on employee_goals for select using (true);
-- create policy "goals_insert" on employee_goals for insert with check (true);
-- create policy "goals_update" on employee_goals for update using (true);
-- create policy "goals_delete" on employee_goals for delete using (true);
