-- ============================================================
-- 026_v22_game.sql — v2.2 게임화: 개인 나무·햇빛 포인트·캐릭터 꾸미기·부서 공동 정원
-- ⚠️ 시험 DB 전용. 운영 실행은 PM 승인 뒤(024·025 다음). 여러 번 실행해도 결과 같음.
--
-- 원칙
--  · 운동 기록(exercise_logs)을 그대로 씁니다. 받은 햇빛·나무 단계·정원 진행은 저장하지 않고 기록에서 계산합니다.
--    → 기록을 고치거나 지우면 다음 조회부터 바로 다시 계산되고, 같은 보상이 두 번 생길 수 없습니다.
--  · 저장하는 것은 "쓴 햇빛(구매)", "장착 상태", "피드 표시 여부", "정원 해금 기록"뿐입니다.
--  · 기존 테이블·데이터는 바꾸지 않습니다(새 테이블만 추가).
--  · 새 테이블은 서버(service_role)만 접근: RLS 켜고 정책 없음 + 공개 역할 권한 회수.
--  · 구매 함수도 서버만 실행(공개 역할 실행 권한 회수).
-- ============================================================

-- 1) 도입일: 이 날(한국 시간) 이후 활동부터 햇빛·나무·정원에 반영(지난 기록 소급 없음)
create table if not exists public.game_settings (
  id          integer primary key default 1 check (id = 1),
  launch_date date not null,
  updated_at  timestamptz not null default now()
);
insert into public.game_settings (id, launch_date)
values (1, (now() at time zone 'Asia/Seoul')::date)
on conflict (id) do nothing;   -- 다시 실행해도 처음 정한 도입일 유지

-- 2) 구매(햇빛 사용 내역). 같은 직원·같은 아이템은 1번만(기본키)
create table if not exists public.game_purchases (
  employee_id  uuid not null references public.employees(id) on delete cascade,
  item_key     text not null check (item_key ~ '^[a-z]+_[a-z]+$'),
  price        integer not null check (price between 1 and 1000),
  purchased_at timestamptz not null default now(),
  primary key (employee_id, item_key)
);

-- 3) 장착 상태(부위별 1개). 가진 아이템만 장착 가능(구매 행을 참조)
create table if not exists public.game_equipment (
  employee_id uuid not null,
  slot        text not null check (slot in ('hat', 'top', 'shoes')),
  item_key    text not null,
  updated_at  timestamptz not null default now(),
  primary key (employee_id, slot),
  foreign key (employee_id, item_key) references public.game_purchases(employee_id, item_key) on delete cascade
);

-- 4) 피드에 내 나무·캐릭터 보이기(기본 꺼짐)
create table if not exists public.game_profiles (
  employee_id  uuid primary key references public.employees(id) on delete cascade,
  show_in_feed boolean not null default false,
  updated_at   timestamptz not null default now()
);

-- 5) 부서 정원 해금 기록. 부서·주(월요일)마다 1번만(기본키). 달성 여부는 기록에서 다시 계산해 맞춥니다.
create table if not exists public.garden_unlocks (
  department_id uuid not null references public.departments(id) on delete cascade,
  week_start    date not null check (extract(isodow from week_start) = 1),
  goal          integer not null check (goal >= 1),
  unlocked_at   timestamptz not null default now(),
  primary key (department_id, week_start)
);

-- 5-1) 주간 목표 변경 이력 (PM 최종 보완 11-13)
--   v2.1 personal_goals 는 같은 주 안에서 바꾸면 덮어쓰므로, 바꿀 때마다 한 줄씩 남깁니다.
--   게임 보상 판정 = 그 주가 시작될 때(월요일 0시, 한국 시간) 적용 중이던 목표.
--   그 주에 처음 정했다면 그 주에 처음 정한 목표. 주중 변경은 다음 주부터 게임에 반영.
--   (v2.1 목표·달성률 화면은 personal_goals 그대로 — 바뀌지 않음)
create table if not exists public.personal_goal_history (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind        text not null check (kind in ('sessions', 'minutes')),
  target      integer not null check (target between 1 and 2100),
  changed_at  timestamptz not null default now()
);
create index if not exists personal_goal_history_emp_idx on public.personal_goal_history(employee_id, changed_at);
-- 이미 있는 목표(024 이후 정한 것)는 그 주 월요일 0시에 정한 것으로 한 줄씩 옮겨 둡니다(이력이 없는 직원만, 다시 실행해도 중복 없음)
insert into public.personal_goal_history (employee_id, kind, target, changed_at)
select p.employee_id, p.kind, p.target, (p.effective_from::timestamp at time zone 'Asia/Seoul')
from public.personal_goals p
where not exists (select 1 from public.personal_goal_history h where h.employee_id = p.employee_id);

-- 6) 접근: 서버만
do $$
declare t text;
begin
  foreach t in array array['game_settings', 'game_purchases', 'game_equipment', 'game_profiles', 'garden_unlocks', 'personal_goal_history'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 7) 구매: 한 트랜잭션 안에서 직원별 잠금 → 이미 가짐 확인 → 잔액 확인 → 기록
--    p_earned(받은 햇빛)와 p_price(가격)는 서버가 운동 기록·아이템 목록에서 계산해 넘깁니다(화면 값 사용 안 함).
--    같은 직원의 구매 요청이 동시에 와도 잠금 때문에 하나씩 처리되어 잔액보다 많이 쓸 수 없습니다.
create or replace function public.game_purchase(p_employee uuid, p_item text, p_price integer, p_earned integer)
returns json
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_spent integer;
begin
  if p_price is null or p_price < 1 or p_earned is null or p_earned < 0 then
    return json_build_object('status', 'invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('game_purchase:' || p_employee::text, 0));
  if exists (select 1 from game_purchases where employee_id = p_employee and item_key = p_item) then
    return json_build_object('status', 'already_owned');
  end if;
  select coalesce(sum(price), 0) into v_spent from game_purchases where employee_id = p_employee;
  if p_earned - v_spent < p_price then
    return json_build_object('status', 'insufficient', 'balance', greatest(p_earned - v_spent, 0));
  end if;
  insert into game_purchases (employee_id, item_key, price) values (p_employee, p_item, p_price);
  return json_build_object('status', 'ok', 'balance', p_earned - v_spent - p_price);
end
$$;
revoke all on function public.game_purchase(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.game_purchase(uuid, text, integer, integer) to service_role;

-- ── 확인 쿼리: 새 테이블 6개 RLS on·정책 0·공개 권한 없음, 구매 함수 공개 실행 불가 ──
select
  (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relrowsecurity
     and relname in ('game_settings','game_purchases','game_equipment','game_profiles','garden_unlocks','personal_goal_history')) as rls_tables,
  (select count(*) from pg_policies where schemaname = 'public'
     and tablename in ('game_settings','game_purchases','game_equipment','game_profiles','garden_unlocks','personal_goal_history')) as policies,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated')
     and table_name in ('game_settings','game_purchases','game_equipment','game_profiles','garden_unlocks','personal_goal_history')) as public_grants,
  has_function_privilege('anon', 'public.game_purchase(uuid, text, integer, integer)', 'execute') as anon_can_buy,
  (select launch_date from public.game_settings where id = 1) as launch_date;

-- ── 되돌리기 (구매·장착·정원 해금 기록이 사라짐에 주의. 운동 기록은 영향 없음) ──
-- drop function if exists public.game_purchase(uuid, text, integer, integer);
-- drop table if exists public.personal_goal_history, public.garden_unlocks, public.game_profiles, public.game_equipment, public.game_purchases, public.game_settings;
