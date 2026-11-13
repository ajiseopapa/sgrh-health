-- ============================================================
-- 030_reopen_suggestions.sql — 건의하기 다시 열기(028 되돌리기)
-- 운영: 2026-11-13 TK님이 SQL Editor 에서 실행함(이 파일은 그 기록). 시험 DB 에도 같은 내용 적용.
-- 028 이 지운 공개 읽기·쓰기를 다시 엽니다(익명 작성, 목록 공개 — 예전 동작과 같은 효과). 자료는 그대로.
-- 여러 번 실행해도 결과 같음.
-- ============================================================
grant select, insert on table public.suggestions to anon, authenticated;
drop policy if exists "public select" on public.suggestions;
drop policy if exists "public insert" on public.suggestions;
create policy "public select" on public.suggestions for select using (true);
create policy "public insert" on public.suggestions for insert with check (true);

-- ── 확인: 정책 2, 공개 읽기·쓰기 true ──
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'suggestions') as policies,
  has_table_privilege('anon', 'public.suggestions', 'select') as anon_select,
  has_table_privilege('anon', 'public.suggestions', 'insert') as anon_insert,
  (select count(*) from public.suggestions) as rows_kept;
