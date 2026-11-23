-- ============================================================
-- 023_lock_races.sql — 옛 대회 테이블(races) 접근 차단 (PM 결정: 삭제하지 않고 접근 차단)
-- ⚠️ 운영 실행은 PM 최종 승인 뒤. 021·022와 별개이며 순서 무관(앱은 races를 쓰지 않음).
--
-- 무엇: 공개 역할(anon·authenticated)의 races 읽기·넣기·수정·삭제를 두 겹으로 막습니다.
--   ① RLS 정책 4개 삭제 (RLS는 켜진 채 유지 → 정책이 없으면 공개 역할은 0행)
--   ② 테이블 권한 회수 (정책이 실수로 다시 생겨도 접근 불가)
-- 그대로 두는 것: 데이터 17건, 테이블 구조·인덱스·기본키, service_role(서버)·postgres(관리자) 접근
-- 여러 번 실행해도 결과 같음. 데이터는 바꾸지 않습니다.
-- ============================================================

-- RLS가 꺼져 있으면 켬 (운영은 이미 켜져 있음)
alter table public.races enable row level security;

-- ① 공개 정책 삭제 (이름과 상관없이 races의 정책 전부)
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'races'
  loop
    execute format('drop policy %I on public.races', p.policyname);
  end loop;
end $$;

-- ② 공개 역할의 테이블 권한 회수 (service_role·postgres 권한은 그대로)
revoke all on table public.races from anon, authenticated;

-- ── 확인 쿼리: policies 0, anon·authenticated 권한 없음, service_role 권한 있음, 건수는 실행 전과 같음 ──
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'races') as policies,
  has_table_privilege('anon', 'public.races', 'select') as anon_select,
  has_table_privilege('authenticated', 'public.races', 'select') as auth_select,
  has_table_privilege('service_role', 'public.races', 'select') as service_select,
  (select relrowsecurity from pg_class where oid = 'public.races'::regclass) as rls_on,
  (select count(*) from public.races) as rows;

-- ── 되돌리기 (023 실행 전 상태로, 11-10 운영 스키마 백업과 같은 정의) ──
-- grant select, insert, update, delete, truncate, references, trigger on table public.races to anon, authenticated;
-- create policy "anon read races"   on public.races for select using (true);
-- create policy "anon insert races" on public.races for insert with check (true);
-- create policy "anon update races" on public.races for update using (true);
-- create policy "anon delete races" on public.races for delete using (true);
