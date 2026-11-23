-- ============================================================
-- 033_garden_placements.sql — 나의 정원 1단계(꾸미기): 나무 둘레 8칸에 놓은 장식
-- ⚠️ 운영은 TK님이 직접 실행(앱 배포 "전"에). 026 다음이면 됨. 여러 번 실행해도 결과 같음.
--
-- 원칙
--  · 기존 테이블·데이터는 바꾸지 않습니다(새 테이블 1개 + 새 함수 1개).
--  · 장식 구매는 기존 game_purchases / game_purchase() 를 그대로 씁니다(키는 decor_xxx).
--  · 여기 저장하는 것은 "어느 칸에 어떤 장식을 놓았는지"뿐입니다.
--  · 가진 장식만 놓을 수 있음(구매 행을 참조). 한 칸에 하나, 같은 장식은 한 칸에만.
--  · 서버(service_role)만 접근: RLS 켜고 정책 없음 + 공개 역할 권한 회수. 함수도 서버만 실행.
-- ============================================================

create table if not exists public.garden_placements (
  employee_id uuid not null,
  slot        smallint not null check (slot between 0 and 7),
  item_key    text not null check (item_key like 'decor\_%'),
  updated_at  timestamptz not null default now(),
  primary key (employee_id, slot),
  unique (employee_id, item_key),
  foreign key (employee_id, item_key) references public.game_purchases(employee_id, item_key) on delete cascade
);

alter table public.garden_placements enable row level security;
revoke all on table public.garden_placements from anon, authenticated;

-- 놓기·옮기기·빼기: 한 트랜잭션 안에서 직원별 잠금
--   p_item 이 null → 그 칸을 비움
--   p_item 이 다른 칸에 놓여 있으면 → 이 칸으로 옮김. 이 칸에 다른 장식이 있었으면 서로 자리를 바꿈
--   p_item 이 안 놓여 있으면 → 이 칸에 놓음. 이 칸에 있던 장식은 빠짐(가진 것으로 남음)
create or replace function public.garden_place(p_employee uuid, p_slot integer, p_item text)
returns json
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_from  smallint;
  v_other text;
begin
  if p_slot is null or p_slot < 0 or p_slot > 7 then
    return json_build_object('status', 'invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('garden_place:' || p_employee::text, 0));

  if p_item is null then
    delete from garden_placements where employee_id = p_employee and slot = p_slot;
    return json_build_object('status', 'ok');
  end if;
  if p_item not like 'decor\_%' then
    return json_build_object('status', 'invalid');
  end if;
  if not exists (select 1 from game_purchases where employee_id = p_employee and item_key = p_item) then
    return json_build_object('status', 'not_owned');
  end if;

  select slot into v_from from garden_placements where employee_id = p_employee and item_key = p_item;
  if v_from = p_slot then
    return json_build_object('status', 'ok');
  end if;
  select item_key into v_other from garden_placements where employee_id = p_employee and slot = p_slot;

  delete from garden_placements where employee_id = p_employee and (slot = p_slot or item_key = p_item);
  insert into garden_placements (employee_id, slot, item_key) values (p_employee, p_slot, p_item);
  if v_from is not null and v_other is not null then
    insert into garden_placements (employee_id, slot, item_key) values (p_employee, v_from, v_other);
  end if;
  return json_build_object('status', 'ok');
end
$$;
revoke all on function public.garden_place(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.garden_place(uuid, integer, text) to service_role;

-- ── 확인 쿼리: 표 있음(1), RLS 켜짐(true), 정책 0, 공개 권한 0, 공개 역할은 함수 실행 불가(false) ──
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'garden_placements') as table_exists,
  (select relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = 'garden_placements') as rls_on,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'garden_placements') as policies,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public'
     and grantee in ('anon','authenticated') and table_name = 'garden_placements') as public_grants,
  has_function_privilege('anon', 'public.garden_place(uuid, integer, text)', 'execute') as anon_can_place;

-- ── 되돌리기 (정원 배치가 모두 사라짐. 장식 구매 기록과 쓴 햇빛은 game_purchases 에 그대로 남음) ──
-- drop function if exists public.garden_place(uuid, integer, text);
-- drop table if exists public.garden_placements;
