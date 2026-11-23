-- ============================================================
-- races_inspect.sql — races 테이블 참조 조사 (읽기 전용, 운영 DB 변경 없음)
-- 운영 후속 작업 지시서 작업 2. 운영 SQL Editor에서 실행 → 결과 표를 캡처하거나 Download CSV.
-- 모든 줄이 select 뿐이라 데이터·구조를 바꾸지 않습니다.
-- ============================================================

select '1 건수' as 항목, 'races' as 대상, count(*)::text as 내용 from public.races

union all
-- 2) 다른 테이블이 races를 외래키로 참조하는지 (없으면 줄이 안 나옴)
select '2 외래키 참조', conrelid::regclass::text, pg_get_constraintdef(oid)
from pg_constraint
where contype = 'f' and confrelid = 'public.races'::regclass

union all
-- 3) races에 걸린 트리거
select '3 트리거', tgname, pg_get_triggerdef(oid)
from pg_trigger
where tgrelid = 'public.races'::regclass and not tgisinternal

union all
-- 4) 본문에 races가 나오는 함수 (public·다른 사용자 스키마)
select '4 함수 본문 언급', n.nspname || '.' || p.proname, left(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g'), 200)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog', 'information_schema', 'extensions', 'graphql', 'graphql_public', 'pgsodium', 'vault', 'realtime', 'storage', 'auth', 'supabase_functions', 'net', 'cron', 'pgbouncer')
  and p.prokind in ('f', 'p')
  and pg_get_functiondef(p.oid) ilike '%races%'

union all
-- 5) races를 쓰는 뷰
select '5 뷰', v.view_schema || '.' || v.view_name, 'races 사용'
from information_schema.view_table_usage v
where v.table_schema = 'public' and v.table_name = 'races'

union all
-- 6) RLS 정책
select '6 정책', policyname, cmd || ' to ' || array_to_string(roles, ',') || coalesce(' using (' || qual || ')', '') || coalesce(' with check (' || with_check || ')', '')
from pg_policies
where schemaname = 'public' and tablename = 'races'

union all
-- 7) 역할별 테이블 권한
select '7 권한', grantee, string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'races'
group by grantee

union all
-- 8) 예약 작업(pg_cron)이 있는지 — 확장이 없으면 이 줄은 "확장 없음"
select '8 예약 작업 확장', 'pg_cron', case when exists (select 1 from pg_extension where extname = 'pg_cron') then '설치됨 → cron.job 에서 races 검색 필요' else '확장 없음' end

union all
-- 9) 마지막 쓰기 시점 (통계 기준, 서버 재시작 뒤엔 0부터 다시 셈)
select '9 쓰기 통계', 'races', 'insert ' || n_tup_ins || ' / update ' || n_tup_upd || ' / delete ' || n_tup_del || ' / 마지막 분석 ' || coalesce(last_autoanalyze::text, '-')
from pg_stat_user_tables
where schemaname = 'public' and relname = 'races'

order by 1, 2;
