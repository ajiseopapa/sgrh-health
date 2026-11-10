-- ============================================================
-- 020_calendar_summary.sql — 집계형 달력용 날짜별 요약 함수
-- 실행 순서: 019 이후 (테이블·데이터 변경 없음, 읽기 전용 함수 1개 추가)
--
-- 한 달치 기록을 DB 안에서 날짜별로 집계해 최대 31줄만 돌려줍니다.
-- → 기록이 많아도 1,000건 조회 제한에 걸리지 않습니다.
--
-- 반환(JSON):
--   headcount : 그 달 1일 기준 재직 인원. 정보가 없으면 null
--   days      : [{ d: 'YYYY-MM-DD', p: 참여 인원(중복 제외), n: 기록 수, s: 총 운동 초 }]
--
-- ⚠️ 재직 인원 정의 (임시): "그 달 1일 이전에 등록된 직원 수".
--    지금 DB에는 퇴사·입사일 정보가 없어서 이렇게 근사합니다(퇴사자는 삭제되므로 현재 인원 기준).
--    그 달 1일 이전 등록 직원이 0명이면 null → 화면은 참여 인원만 표시하고 색상 농도를 쓰지 않습니다.
--    P1 부서·퇴사 처리(employees.status 등)가 생기면 이 정의만 바꾸면 됩니다.
-- ============================================================

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
    select count(*)::int as c
    from employees e, bounds b
    where e.created_at < (b.m_start + interval '1 day')
  )
  select json_build_object(
    'headcount', (select nullif(c, 0) from hc),
    'days', coalesce(
      (select json_agg(json_build_object('d', to_char(log_date, 'YYYY-MM-DD'), 'p', p, 'n', n, 's', s) order by log_date) from days),
      '[]'::json)
  )
$$;

-- 운동 기록·직원 명단은 원래 화면에서 공개로 읽히는 정보라, 집계 함수도 공개 키로 호출 가능
revoke all on function calendar_month_summary(date) from public;
grant execute on function calendar_month_summary(date) to anon, authenticated, service_role;

-- ── 확인 쿼리: 이번 달 요약 (days가 날짜별로 나오면 정상) ──
select calendar_month_summary(current_date);

-- ── 되돌리기 ──
-- drop function if exists calendar_month_summary(date);
