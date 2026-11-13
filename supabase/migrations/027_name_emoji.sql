-- ============================================================
-- 027_name_emoji.sql — 피드 이름 앞 이모지(본인이 고름)
-- 026 다음에 실행. 여러 번 실행해도 결과 같음. 기존 행·데이터 변경 없음(새 칸은 비어 있음).
--
-- game_profiles 에 칸 하나만 추가합니다. 어떤 이모지를 쓸 수 있는지는 서버가 정해진 목록으로 확인하고,
-- DB 는 길이만 막습니다. 표는 026 에서 이미 RLS on·공개 권한 없음이라 공개 키로는 읽고 쓸 수 없습니다.
-- ============================================================

alter table public.game_profiles add column if not exists name_emoji text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'game_profiles_name_emoji_len') then
    alter table public.game_profiles
      add constraint game_profiles_name_emoji_len check (name_emoji is null or char_length(name_emoji) between 1 and 8);
  end if;
end $$;

-- ── 확인 쿼리: 칸 있음(1), 길이 제한 있음(true), 공개 권한 여전히 없음(0) ──
select
  (select count(*) from information_schema.columns where table_schema = 'public'
     and table_name = 'game_profiles' and column_name = 'name_emoji') as name_emoji_col,
  exists (select 1 from pg_constraint where conname = 'game_profiles_name_emoji_len') as has_len_check,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public'
     and grantee in ('anon','authenticated') and table_name = 'game_profiles') as public_grants;

-- ── 되돌리기 (고른 이모지가 사라짐. 운동 기록 영향 없음) ──
-- alter table public.game_profiles drop constraint if exists game_profiles_name_emoji_len;
-- alter table public.game_profiles drop column if exists name_emoji;
