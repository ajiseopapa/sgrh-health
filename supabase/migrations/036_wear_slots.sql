-- ============================================================
-- 036_wear_slots.sql — 캐릭터 꾸미기 아이템 칸 늘리기(모자·상의·신발 3칸 → 9칸)
-- ⚠️ 운영은 TK님이 직접 실행(앱 배포 전에 실행해도, 뒤에 실행해도 됨). 035 다음. 여러 번 실행해도 결과 같음.
-- 기존 행·데이터 변경 없음. 칸 이름 검사만 넓힘.
--  · 실행 전: 새 앱에서 모자·상의·신발 아이템은 입을 수 있고, 나머지 칸(머리 장식·안경·하의·가방·소품·특별)은
--    "캐릭터 꾸미기는 준비 중"으로 안내(사는 것은 됨).
-- 칸: back · shoes · bottom · top · face · hair · hat · hand · effect (lib/game.ts SLOTS)
-- ============================================================

do $$
declare c text;
begin
  -- 026 에서 이름 없이 만든 칸 검사(slot in ('hat','top','shoes'))를 찾아 지움
  for c in
    select conname from pg_constraint
    where conrelid = 'public.game_equipment'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%slot%' and conname <> 'game_equipment_slot_chk'
  loop
    execute format('alter table public.game_equipment drop constraint %I', c);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'game_equipment_slot_chk') then
    alter table public.game_equipment add constraint game_equipment_slot_chk
      check (slot in ('back', 'shoes', 'bottom', 'top', 'face', 'hair', 'hat', 'hand', 'effect'));
  end if;
end $$;

-- ── 확인 쿼리: 칸 검사 1개(1), 새 칸 허용(true), 공개 권한 없음(0),
--    예전 이모지 아이템 구매 기록 수(old_item_purchases — 0 이 아니면 TK님께 알릴 것: 새 앱에서는 안 보이고 쓴 햇빛만 남음) ──
select
  (select count(*) from pg_constraint where conrelid = 'public.game_equipment'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%slot%') as slot_checks,
  (select pg_get_constraintdef(oid) like '%effect%' from pg_constraint where conname = 'game_equipment_slot_chk') as allows_new,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public'
     and grantee in ('anon','authenticated') and table_name = 'game_equipment') as public_grants,
  (select count(*) from public.game_purchases
     where item_key in ('hat_cap','hat_straw','top_singlet','top_jacket','shoes_run','shoes_hike')) as old_item_purchases;

-- ── 되돌리기 (새 칸에 입은 아이템 줄을 지우고 3칸 검사로) ──
-- delete from public.game_equipment where slot not in ('hat', 'top', 'shoes');
-- alter table public.game_equipment drop constraint if exists game_equipment_slot_chk;
-- alter table public.game_equipment add constraint game_equipment_slot_check check (slot in ('hat', 'top', 'shoes'));
