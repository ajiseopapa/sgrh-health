-- ============================================================
-- 028_close_suggestions.sql — 건의하기 기능 폐지(PM 결정): 공개 읽기·쓰기 경로를 닫습니다
-- ⚠️ 시험 DB 전용. 운영 실행은 PM 승인 뒤. 여러 번 실행해도 결과 같음.
--
-- 표(suggestions)와 기존 건의 자료는 그대로 둡니다(삭제 없음). 서버(service_role)는 계속 읽을 수 있어
-- 필요하면 백업·SQL Editor 로 열람할 수 있습니다.
-- 바꾸는 것: suggestions 의 모든 RLS 정책 삭제 + 공개 역할(anon·authenticated) 권한 회수
--   → 공개 키로 건의 작성·목록 읽기 모두 불가. (운영·시험 DB 의 정책 이름이 달라 이름 대신 전부 찾아 지웁니다)
-- ============================================================

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'suggestions' loop
    execute format('drop policy %I on public.suggestions', p.policyname);
  end loop;
end $$;

alter table public.suggestions enable row level security;
revoke all on table public.suggestions from anon, authenticated;

-- ── 확인 쿼리: 정책 0, 공개 읽기·쓰기 false, 자료 건수는 실행 전과 같아야 함 ──
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'suggestions') as policies,
  has_table_privilege('anon', 'public.suggestions', 'select') as anon_select,
  has_table_privilege('anon', 'public.suggestions', 'insert') as anon_insert,
  (select count(*) from public.suggestions) as rows_kept;

-- ── 되돌리기 (건의함을 다시 열 때. 앱 화면도 함께 되돌려야 함) ──
-- grant select, insert on table public.suggestions to anon, authenticated;
-- create policy "public select" on public.suggestions for select using (true);
-- create policy "public insert" on public.suggestions for insert with check (true);
