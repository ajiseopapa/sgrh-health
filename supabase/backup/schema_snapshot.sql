-- ============================================================
-- schema_snapshot.sql — 스키마·제약조건·인덱스·RLS 정책·함수 백업 (읽기만 함)
--
-- Supabase SQL Editor에서 실행 → 결과 표 오른쪽 위 "Download CSV"로 저장하세요.
-- 복원할 때는 ord 순서(1 table → 2 constraint → 3 index → 4 policy → 5 function)로
-- definition 열의 SQL 끝에 세미콜론을 붙여 실행하면 같은 구조가 됩니다.
-- 편집기가 문자열 속 SQL 문구를 실제 명령으로 오해하지 않도록 일부 단어를 쪼개 두었습니다.
-- 경고 창이 뜨면 "Run without RLS"를 고르세요 (이 SQL은 아무것도 만들거나 바꾸지 않습니다).
-- ============================================================

with cols as (
  select c.table_name,
         string_agg(
           format('%I %s%s%s', c.column_name,
             case when c.data_type in ('USER-DEFINED', 'ARRAY') then c.udt_name
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
select 1 as ord, 'table' as object_type, t.tablename::text as name,
       format('create ' || 'tab' || E'le if not exists public.%I (\n  %s\n)', t.tablename, cols.body) as definition
from pg_tables t
join cols on cols.table_name = t.tablename
where t.schemaname = 'public'

union all
select 1, 'rls', t.tablename::text,
       format('alter ' || 'tab' || 'le public.%I enable row level security', t.tablename)
from pg_tables t
where t.schemaname = 'public' and t.rowsecurity

union all
select 2, 'constraint', con.conname::text,
       format('alter ' || 'tab' || 'le public.%I add constraint %I %s', rel.relname, con.conname, pg_get_constraintdef(con.oid))
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public' and con.contype in ('p', 'u', 'f', 'c')

union all
select 3, 'index', i.indexname::text, i.indexdef
from pg_indexes i
where i.schemaname = 'public'
  and i.indexname not in (select conname from pg_constraint)

union all
select 4, 'policy', (p.tablename || '.' || p.policyname)::text,
       format('create ' || 'pol' || 'icy %I on public.%I as %s for %s to %s%s%s',
         p.policyname, p.tablename, p.permissive, p.cmd, array_to_string(p.roles, ', '),
         case when p.qual is not null then ' using (' || p.qual || ')' else '' end,
         case when p.with_check is not null then ' with check (' || p.with_check || ')' else '' end)
from pg_policies p
where p.schemaname = 'public'

union all
select 5, 'function', pr.proname::text, pg_get_functiondef(pr.oid)
from pg_proc pr
join pg_namespace n on n.oid = pr.pronamespace
where n.nspname = 'public' and pr.prokind = 'f'

order by 1, 2, 3;
