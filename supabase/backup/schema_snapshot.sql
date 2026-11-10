-- ============================================================
-- schema_snapshot.sql — 스키마·제약조건·인덱스·RLS 정책·함수 백업 (읽기만 함)
--
-- Supabase SQL Editor에서 실행 → 결과 표 오른쪽 위 "Download CSV"로 저장하세요.
-- 파일 이름 예: schema_snapshot_20261110.csv  (데이터 백업 폴더와 같은 곳에 보관)
-- 복원할 때는 object_type 순서(table → constraint → index → policy → function)로
-- definition 열의 SQL을 그대로 실행하면 같은 구조가 됩니다.
-- ============================================================

with cols as (
  select c.table_name,
         string_agg(
           format('%I %s%s%s', c.column_name,
             case when c.data_type = 'USER-DEFINED' then c.udt_name
                  when c.data_type = 'ARRAY' then c.udt_name
                  when c.character_maximum_length is not null then format('%s(%s)', c.data_type, c.character_maximum_length)
                  when c.data_type = 'numeric' and c.numeric_precision is not null then format('numeric(%s,%s)', c.numeric_precision, c.numeric_scale)
                  else c.data_type end,
             case when c.is_nullable = 'NO' then ' not null' else '' end,
             case when c.column_default is not null then ' default ' || c.column_default else '' end),
           E',\n  ' order by c.ordinal_position) as body
  from information_schema.columns c
  where c.table_schema = 'public'
  group by c.table_name
)
select 1 as ord, 'table' as object_type, t.tablename as name,
       format(E'create table if not exists public.%I (\n  %s\n);\nalter table public.%I enable row level security;', t.tablename, cols.body, t.tablename) as definition
from pg_tables t join cols on cols.table_name = t.tablename
where t.schemaname = 'public'

union all
select 2, 'constraint', con.conname,
       format('alter table public.%I add constraint %I %s;', rel.relname, con.conname, pg_get_constraintdef(con.oid))
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public' and con.contype in ('p', 'u', 'f', 'c')

union all
select 3, 'index', i.indexname, i.indexdef || ';'
from pg_indexes i
where i.schemaname = 'public'
  and i.indexname not in (select conname from pg_constraint)

union all
select 4, 'policy', p.tablename || '.' || p.policyname,
       format('create policy %I on public.%I as %s for %s to %s%s%s;',
         p.policyname, p.tablename, p.permissive, p.cmd, array_to_string(p.roles, ', '),
         case when p.qual is not null then ' using (' || p.qual || ')' else '' end,
         case when p.with_check is not null then ' with check (' || p.with_check || ')' else '' end)
from pg_policies p
where p.schemaname = 'public'

union all
select 5, 'function', pr.proname, pg_get_functiondef(pr.oid) || ';'
from pg_proc pr
join pg_namespace n on n.oid = pr.pronamespace
where n.nspname = 'public' and pr.prokind = 'f'

order by 1, 3;
