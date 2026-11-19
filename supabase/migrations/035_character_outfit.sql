-- ============================================================
-- 035_character_outfit.sql — 캐릭터 의상 고르기: 본인이 고른 의상 저장
-- ⚠️ 운영은 TK님이 직접 실행(앱 배포 전에 실행해도, 뒤에 실행해도 됨). 034 다음. 여러 번 실행해도 결과 같음.
-- 기존 행·데이터 변경 없음(새 칸은 비어 있음 = 기본 의상 '운동복').
--  · 실행 전: 새 앱에서 의상을 고르면 "의상 저장은 준비 중이에요"로 안내하고, 나머지는 그대로 동작.
--  · 값은 영문 소문자·숫자 이름만(예: nurse). 어떤 의상이 있는지는 앱(lib/game.ts OUTFITS)이 정하므로 의상을 늘려도 SQL이 필요 없음.
-- ============================================================

alter table public.game_profiles add column if not exists outfit text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'game_profiles_outfit_chk') then
    alter table public.game_profiles
      add constraint game_profiles_outfit_chk check (outfit is null or outfit ~ '^[a-z0-9]{1,20}$');
  end if;
end $$;

notify pgrst, 'reload schema';

-- ── 확인 쿼리: 칸 있음(1), 값 제한 있음(true), 공개 권한 여전히 없음(0) ──
select
  (select count(*) from information_schema.columns where table_schema = 'public'
     and table_name = 'game_profiles' and column_name = 'outfit') as outfit_col,
  exists (select 1 from pg_constraint where conname = 'game_profiles_outfit_chk') as has_check,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public'
     and grantee in ('anon','authenticated') and table_name = 'game_profiles') as public_grants;

-- ── 되돌리기 (고른 의상이 사라지고 모두 기본 의상으로 보임) ──
-- alter table public.game_profiles drop constraint if exists game_profiles_outfit_chk;
-- alter table public.game_profiles drop column if exists outfit;
