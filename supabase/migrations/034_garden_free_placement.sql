-- ============================================================
-- 034_garden_free_placement.sql — 나의 정원 자유 배치: 칸 번호(slot) 대신 좌표(x, y)
-- ⚠️ 운영은 TK님이 직접 실행(앱 배포 "전"에). 033 다음. 여러 번 실행해도 결과 같음.
--
-- 좌표: 정원은 80×80칸. (x, y) = 장식의 발끝(그림 아래쪽 가운데) 위치, 0~80 정수.
--
-- 옛 앱(칸 방식)이 이 SQL 실행 뒤에도 그대로 돌아가도록:
--  · slot 칸과 옛 함수 garden_place 는 남깁니다(slot 은 비어 있을 수 있게만 바꿈).
--  · 옛 앱이 놓은 줄(x, y 비어 있음)은 새 앱이 slot 에서 좌표를 계산해 보여 줍니다.
--  · 기존 배치는 칸 위치에 해당하는 좌표로 옮겨 적습니다(좌표가 빈 줄만).
-- 기본키: (직원, 칸) → (직원, 장식). 같은 장식은 여전히 한 번만 놓을 수 있습니다.
-- ============================================================

alter table public.garden_placements add column if not exists x smallint;
alter table public.garden_placements add column if not exists y smallint;

do $$
begin
  -- 기본키가 (employee_id, slot) 이면 (employee_id, item_key) 로 바꿈
  if exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.garden_placements'::regclass and c.contype = 'p' and a.attname = 'slot'
  ) then
    alter table public.garden_placements drop constraint garden_placements_pkey;
    alter table public.garden_placements add constraint garden_placements_pkey primary key (employee_id, item_key);
  end if;
  -- 기본키에서 빠진 뒤에야 slot 을 비울 수 있게 바꿀 수 있음(옛 앱이 놓은 줄은 slot 있음, 새 앱이 놓은 줄은 slot 없음)
  alter table public.garden_placements alter column slot drop not null;
  if not exists (select 1 from pg_constraint where conname = 'garden_placements_xy_chk') then
    alter table public.garden_placements add constraint garden_placements_xy_chk
      check ((x is null and y is null) or (x between 0 and 80 and y between 0 and 80));
  end if;
end $$;

-- 기존 칸 배치 → 좌표 (칸 0~7 = 3×3 에서 가운데를 뺀 순서). 좌표가 빈 줄만.
update public.garden_placements p
set x = (array[14, 40, 66, 14, 66, 14, 40, 66])[p.slot + 1],
    y = (array[26, 26, 26, 52, 52, 78, 78, 78])[p.slot + 1]
where p.x is null and p.slot is not null;

-- 놓기·옮기기(p_x, p_y 지정) / 빼기(p_x null). 직원별 잠금, 가진 장식만.
create or replace function public.garden_put(p_employee uuid, p_item text, p_x integer, p_y integer)
returns json
language plpgsql
volatile
security invoker
set search_path = public
as $$
begin
  if p_item is null or p_item not like 'decor\_%' then
    return json_build_object('status', 'invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('garden_place:' || p_employee::text, 0));
  if p_x is null then
    delete from garden_placements where employee_id = p_employee and item_key = p_item;
    return json_build_object('status', 'ok');
  end if;
  if p_y is null or p_x < 0 or p_x > 80 or p_y < 0 or p_y > 80 then
    return json_build_object('status', 'invalid');
  end if;
  if not exists (select 1 from game_purchases where employee_id = p_employee and item_key = p_item) then
    return json_build_object('status', 'not_owned');
  end if;
  insert into garden_placements (employee_id, item_key, x, y, slot, updated_at)
  values (p_employee, p_item, p_x, p_y, null, now())
  on conflict (employee_id, item_key) do update set x = excluded.x, y = excluded.y, slot = null, updated_at = now();
  return json_build_object('status', 'ok');
end
$$;
revoke all on function public.garden_put(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.garden_put(uuid, text, integer, integer) to service_role;

-- ── 확인 쿼리: 좌표 칸 2개, 기본키에 item_key(true), 좌표 빈 줄 0, 공개 권한 0, 공개 역할은 함수 실행 불가(false) ──
select
  (select count(*) from information_schema.columns where table_schema = 'public'
     and table_name = 'garden_placements' and column_name in ('x', 'y')) as xy_cols,
  exists (select 1 from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.conrelid = 'public.garden_placements'::regclass and c.contype = 'p' and a.attname = 'item_key') as pk_by_item,
  (select count(*) from public.garden_placements where x is null) as rows_without_xy,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public'
     and grantee in ('anon','authenticated') and table_name = 'garden_placements') as public_grants,
  has_function_privilege('anon', 'public.garden_put(uuid, text, integer, integer)', 'execute') as anon_can_put;

-- ── 되돌리기 (좌표가 사라지고 칸 방식으로 돌아감. 자유 배치로 놓은 장식은 slot 이 비어 정원에서 빠짐 — 가진 장식은 그대로) ──
-- drop function if exists public.garden_put(uuid, text, integer, integer);
-- delete from public.garden_placements where slot is null;
-- alter table public.garden_placements drop constraint if exists garden_placements_xy_chk;
-- alter table public.garden_placements drop constraint garden_placements_pkey;
-- alter table public.garden_placements alter column slot set not null;
-- alter table public.garden_placements add constraint garden_placements_pkey primary key (employee_id, slot);
-- alter table public.garden_placements drop column if exists x, drop column if exists y;
