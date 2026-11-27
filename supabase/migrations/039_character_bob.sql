-- ============================================================
-- 039_character_bob.sql — 캐릭터 '단발녀'(b) 추가: game_profiles.character 허용값을 m·f → m·f·b 로
-- ⚠️ 운영은 TK님이 직접 실행. 배포 전·후 아무 때나 가능
--    (실행 전 앱: 단발녀는 살 수 있지만 고르면 "이 캐릭터는 준비 중이에요"). 여러 번 실행해도 결과 같음.
-- 단발녀 구매 기록은 기존 game_purchases(키 char_bob, 햇빛 50)에 남으므로 표 변경은 이것뿐입니다.
-- 되돌리기(단발녀를 고른 직원이 없을 때만):
--   alter table public.game_profiles drop constraint if exists game_profiles_character_chk;
--   alter table public.game_profiles add constraint game_profiles_character_chk check (character is null or character in ('m', 'f'));
-- ============================================================

alter table public.game_profiles drop constraint if exists game_profiles_character_chk;
alter table public.game_profiles
  add constraint game_profiles_character_chk check (character is null or character in ('m', 'f', 'b'));

-- 확인: 허용값에 'b' 가 있으면 1
select count(*) as has_bob from pg_constraint
 where conname = 'game_profiles_character_chk' and pg_get_constraintdef(oid) like '%''b''%';
