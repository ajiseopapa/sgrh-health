-- ============================================================
-- 038_guestbook_edit_seen.sql — 방명록 글 수정 표시 · 내 정원 방명록을 마지막으로 본 시각(새 글 알림용)
-- ⚠️ 운영은 TK님이 직접 실행. 037 다음. 배포 전·후 아무 때나 가능
--    (실행 전 앱: 수정은 "준비 중" 안내, 새 글 표시는 안 뜸). 여러 번 실행해도 결과 같음.
-- 기존 데이터는 바꾸지 않습니다(칸 2개 추가, 빈 값으로 시작).
-- 되돌리기:
--   alter table public.garden_guestbook drop column if exists edited_at;
--   alter table public.game_profiles drop column if exists guestbook_seen_at;
-- ============================================================

alter table public.garden_guestbook add column if not exists edited_at timestamptz;
alter table public.game_profiles   add column if not exists guestbook_seen_at timestamptz;

-- 확인: 2 이면 정상
select count(*) as added_columns from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'garden_guestbook' and column_name = 'edited_at')
     or (table_name = 'game_profiles' and column_name = 'guestbook_seen_at'));
