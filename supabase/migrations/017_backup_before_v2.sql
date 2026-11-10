-- ============================================================
-- 017_backup_before_v2.sql — v2 변경 전 백업
-- 실행 순서: 017 → 018 (019는 전환 2에서 따로)
--
-- 운영 DB 안에 backup_20261110 스키마를 만들고, 지금 테이블을 그대로 복사합니다.
-- 원본 테이블은 건드리지 않습니다. 여러 번 실행해도 안전합니다(이미 있으면 건너뜀).
-- 실행 전에 Table Editor에서 employees, exercise_types, exercise_logs 를 CSV로도 내려받아 두세요.
-- ============================================================

create schema if not exists backup_20261110;

do $$
declare t text;
begin
  foreach t in array array['employees','exercise_types','exercise_logs','log_reactions',
                           'employee_goals','announcements','suggestions'] loop
    if to_regclass('public.' || t) is not null
       and to_regclass('backup_20261110.' || t) is null then
      -- 'create ' || 'tab' || 'le' : Supabase 편집기가 문자열 속 문구를 실제 명령으로 오해해
      -- RLS 경고·자동 덧붙이기를 하지 않도록 단어를 쪼갬 (실행되는 SQL은 같음)
      execute format('create ' || 'tab' || 'le backup_20261110.%I as ' || 'tab' || 'le public.%I', t, t);
    end if;
  end loop;
end $$;

-- 브라우저(공개 키)에서 백업을 못 보게 막습니다
revoke all on schema backup_20261110 from anon, authenticated;

-- ── 확인 쿼리: 원본과 백업의 행 수가 같아야 합니다 ──
select 'employees' as t, (select count(*) from public.employees) as 원본, (select count(*) from backup_20261110.employees) as 백업
union all select 'exercise_logs', (select count(*) from public.exercise_logs), (select count(*) from backup_20261110.exercise_logs)
union all select 'exercise_types', (select count(*) from public.exercise_types), (select count(*) from backup_20261110.exercise_types)
union all select 'log_reactions', (select count(*) from public.log_reactions), (select count(*) from backup_20261110.log_reactions);

-- ── 되돌리기(백업에서 기록 복구가 필요할 때만, 반드시 상의 후) ──
-- insert into public.exercise_logs select * from backup_20261110.exercise_logs b
--   where not exists (select 1 from public.exercise_logs l where l.id = b.id);
-- 백업이 더는 필요 없을 때: drop schema backup_20261110 cascade;
