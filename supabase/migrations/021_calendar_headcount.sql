-- ============================================================
-- 021_calendar_headcount.sql — 달력 참여율 분모를 별도 함수로 분리 (PM 달력 UI 최종 보완 지시서 1항)
-- 실행 순서: 020 이후 · ⚠️ 운영 실행은 PM 최종 승인 뒤
-- 테이블·데이터·정책 변경 없음. 읽기 전용 함수 1개 추가 + 020 함수 교체. 여러 번 실행해도 결과 같음.
--
-- 분모 계산은 calendar_headcount() 하나에만 둡니다.
-- 나중에 인사팀 재직 인원 자료로 바꿀 때는 이 함수만 교체하고, basis를 'hr'로 돌려주면
-- 화면 문구가 "등록 직원 기준" → "재직 인원 기준"으로 자동으로 바뀝니다.
--
-- 11-11 보완 (운영 후속 작업 지시서 작업 1 검증 중 발견):
--   이전 안은 분모를 "그 달 1일까지 등록된 직원"으로 고정해, 월 중에 등록한 직원이 운동하면
--   참여 인원이 분모보다 커져 100%를 넘을 수 있었습니다(운영 7월: 1일 4명 → 말일 7명).
--   → 분모를 "그날까지 등록된 직원"으로 날짜마다 계산합니다(days[].h).
--   또 등록 시각을 한국 시간 기준 날짜로 자릅니다(이전 안은 UTC 기준이라 9시간 어긋남).
-- ============================================================

-- 분모: (임시 기준) p_day 날짜(한국 시간) 끝까지 등록된 직원 수. 0명이면 null = "인원 정보 없음"
create or replace function calendar_headcount(p_day date)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'count', nullif(count(*)::int, 0),
    'basis', 'registered'
  )
  from employees e
  where e.created_at < ((p_day + 1)::timestamp at time zone 'Asia/Seoul')
$$;

revoke all on function calendar_headcount(date) from public;
grant execute on function calendar_headcount(date) to anon, authenticated, service_role;

-- 020 함수 교체. 돌려주는 형식은 020과 같고 칸만 늘어남 → 지금 운영 화면과도 호환
--   headcount       : 범례용 분모 = 그 달 말일(이번 달이면 오늘)까지 등록된 직원 수
--   headcount_basis : 'registered' (인사팀 자료로 바뀌면 'hr')
--   days[].h        : 그날까지 등록된 직원 수 = 그날 참여율의 분모.
--                     등록 전 날짜로 기록을 남긴 직원이 있어 참여 인원이 더 많으면 참여 인원을 분모로 씀(100% 초과 방지)
create or replace function calendar_month_summary(p_month date)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select date_trunc('month', p_month)::date as m_start,
           (date_trunc('month', p_month) + interval '1 month')::date as m_end
  ),
  days as (
    select l.log_date,
           count(distinct l.employee_id)::int as p,
           count(*)::int as n,
           coalesce(sum(coalesce(l.duration_seconds, l.duration_minutes * 60, 0)), 0)::bigint as s
    from exercise_logs l, bounds b
    where l.log_date >= b.m_start and l.log_date < b.m_end
    group by l.log_date
  ),
  hc as (
    select calendar_headcount(least(b.m_end - 1, (now() at time zone 'Asia/Seoul')::date)) as h
    from bounds b
  )
  select json_build_object(
    'headcount', (select (h ->> 'count')::int from hc),
    'headcount_basis', (select h ->> 'basis' from hc),
    'days', coalesce(
      (select json_agg(json_build_object(
                'd', to_char(log_date, 'YYYY-MM-DD'), 'p', p, 'n', n, 's', s,
                'h', case when hd is null then null else greatest(hd, p) end
              ) order by log_date)
       from (select d.*, (calendar_headcount(d.log_date) ->> 'count')::int as hd from days d) x),
      '[]'::json)
  )
$$;

revoke all on function calendar_month_summary(date) from public;
grant execute on function calendar_month_summary(date) to anon, authenticated, service_role;

-- ── 확인 쿼리: headcount_basis 가 'registered', days 안에 h 가 나오면 정상 ──
select calendar_month_summary(current_date);

-- ── 되돌리기 (020 상태로) — 반드시 이 순서 ──
-- 1) 020_calendar_summary.sql 전체를 다시 실행 (달력 함수가 calendar_headcount 를 안 쓰게 됨)
-- 2) drop function if exists calendar_headcount(date);
-- (순서를 바꾸면 1) 전까지 달력 함수가 오류를 냅니다)
