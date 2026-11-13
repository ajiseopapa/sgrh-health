-- ============================================================
-- 029_character_choice.sql — 픽셀 캐릭터 2종 중 본인이 고른 캐릭터 저장
-- ⚠️ 아직 어디에서도 실행하지 않음(PM: 신규 마이그레이션은 임의 실행 금지, 사유 보고).
-- 026 다음에 실행. 여러 번 실행해도 결과 같음. 기존 행·데이터 변경 없음(새 칸은 비어 있음 = 기본 캐릭터).
--
-- 왜 필요한가: 기존 칸으로는 저장할 곳이 없음
--   · game_profiles: show_in_feed(피드 공개), name_emoji(프로필 이모지)뿐
--   · game_equipment.slot 은 check (hat|top|shoes) + 구매 행 외래키라 캐릭터를 넣을 수 없음
--   · 다른 칸(이모지·구매 행)에 끼워 넣으면 기존 기능과 섞임
-- ============================================================

alter table public.game_profiles add column if not exists character text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'game_profiles_character_chk') then
    alter table public.game_profiles
      add constraint game_profiles_character_chk check (character is null or character in ('m', 'f'));
  end if;
end $$;

-- ── 확인 쿼리: 칸 있음(1), 값 제한 있음(true), 공개 권한 여전히 없음(0) ──
select
  (select count(*) from information_schema.columns where table_schema = 'public'
     and table_name = 'game_profiles' and column_name = 'character') as character_col,
  exists (select 1 from pg_constraint where conname = 'game_profiles_character_chk') as has_check,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public'
     and grantee in ('anon','authenticated') and table_name = 'game_profiles') as public_grants;

-- ── 되돌리기 (고른 캐릭터가 사라지고 모두 기본 캐릭터로 보임) ──
-- alter table public.game_profiles drop constraint if exists game_profiles_character_chk;
-- alter table public.game_profiles drop column if exists character;
