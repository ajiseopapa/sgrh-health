-- ============================================================
-- v22_prod_readonly_check.sql — 운영 DB 적용 상태 점검 (읽기 전용: select 만, 아무것도 바꾸지 않음)
-- 실행: TK님이 운영 Supabase SQL Editor 에 붙여 넣고 Run. 결과 한 줄을 캡처해 주시면 됩니다.
--
-- 024·025·026 이 이미 들어갔는지, 들어갈 바탕(020~023)이 준비됐는지 확인합니다.
-- 기대값(배포 전 정상): has_020~023 = true, has_024·025·026 = false, v21_tables_of_7 = 0, v22_tables_of_6 = 0, name_collisions = 0
-- ============================================================
select
  -- 바탕: 020~023 (v2.0 운영 반영분)
  to_regprocedure('public.calendar_month_summary(date)') is not null                as has_020_calendar,
  to_regprocedure('public.calendar_headcount(date)') is not null                    as has_021_headcount,
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'log_reactions'
              and cmd = 'SELECT' and 'anon' = any(roles))                            as has_022_reactions_locked,
  not has_table_privilege('anon', 'public.races', 'select')                        as has_023_races_locked,

  -- 024 (v2.1): left_at 칸, 새 테이블 7개
  exists (select 1 from information_schema.columns where table_schema = 'public'
          and table_name = 'employees' and column_name = 'left_at')                 as has_024_left_at,
  (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
     and relname in ('departments','department_headcounts','employee_departments','personal_goals',
                     'challenges','challenge_participants','employee_badges'))       as v21_tables_of_7,
  exists (select 1 from information_schema.columns where table_schema = 'public'
          and table_name = 'challenges' and column_name = 'closed')                  as has_024_closed,

  -- 025 (v2.1 P1): employees 칸 단위 공개 읽기, 달력 분모 security definer
  not has_table_privilege('anon', 'public.employees', 'select')                    as has_025_column_grants,
  coalesce((select prosecdef from pg_proc where oid = to_regprocedure('public.calendar_headcount(date)')), false) as has_025_definer,

  -- 026 (v2.2): 새 테이블 6개, 구매 함수
  (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
     and relname in ('game_settings','game_purchases','game_equipment','game_profiles',
                     'garden_unlocks','personal_goal_history'))                      as v22_tables_of_6,
  to_regprocedure('public.game_purchase(uuid, text, integer, integer)') is not null as has_026_purchase_fn,

  -- 참고: 이름이 겹치는 표가 이미 있는지(어디아파 등 같은 프로젝트의 다른 앱) — 0 이어야 함
  (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','v')
     and relname in ('departments','challenges','game_settings','game_purchases','game_equipment',
                     'game_profiles','garden_unlocks','personal_goal_history'))     as name_collisions,

  -- 데이터 규모(백업 시간 가늠용)
  (select count(*) from public.employees)     as employees_rows,
  (select count(*) from public.exercise_logs) as logs_rows,
  version()                                   as pg_version;
