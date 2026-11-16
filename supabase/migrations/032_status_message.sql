-- 032 프로필 한마디 — 동료가 피드에서 내 이름을 누르면 캐릭터와 함께 보이는 짧은 글(40자 이내)
-- 되돌리기: alter table public.game_profiles drop column if exists status_message;

alter table public.game_profiles
  add column if not exists status_message text check (status_message is null or char_length(status_message) <= 40);

select count(*) as has_column from information_schema.columns
 where table_schema = 'public' and table_name = 'game_profiles' and column_name = 'status_message';
