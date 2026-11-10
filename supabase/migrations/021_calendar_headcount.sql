-- ============================================================
-- 021_calendar_headcount.sql — 달력 참여율 분모를 별도 함수로 분리 (PM 달력 UI 최종 보완 지시서 1항)
-- 실행 순서: 020 이후 · ⚠️ 운영 실행은 PM 최종 승인 뒤
-- 테이블·데이터·정책 변경 없음. 읽기 전용 함수 1개 추가 + 020 함수 교체.
--
-- 분모 계산은 calendar_headcount() 하나에만 둡니다.
-- 나중에 인사팀 재직 인원 자료로 바꿀 때는 이 함수만 교체하고, basis를 'hr'로 돌려주면
-- 화면 문구가 "등록 직원 기준" → "재직 인원 기준"으로 자동으로 바뀝니다.
-- ============================================================

-- 분모: (임시 기준) 해당 월 1일까지 등록된 직원 수. 0명이면 null = "인원 정보 없음"
create or replace function calendar_headcount(p_month date)
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
  where e.created_at < (date_trunc('month', p_month)::date + interval '1 day')
$$;

revoke all on function calendar_headcount(date) from public;
grant execute on function calendar_headcount(date) to anon, authenticated, service_role;

-- 020 함수 교체: 분모를 위 함수에서 가져오고, 기준(basis)을 함께 돌려줌
-- (돌려주는 형식은 020과 같고 headcount_basis 한 칸만 늘어남 → 지금 운영 화면과도 호환)
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
  hc as (select calendar_headcount(p_month) as h)
  select json_build_object(
    'headcount', (select (h ->> 'count')::int from hc),
    'headcount_basis', (select h ->> 'basis' from hc),
    'days', coalesce(
      (select json_agg(json_build_object('d', to_char(log_date, 'YYYY-MM-DD'), 'p', p, 'n', n, 's', s) order by log_date) from days),
      '[]'::json)
  )
$$;

revoke all on function calendar_month_summary(date) from public;
grant execute on function calendar_month_summary(date) to anon, authenticated, service_role;

-- ── 확인 쿼리: headcount_basis 가 'registered' 로 나오면 정상 ──
select calendar_month_summary(current_date);

-- ── 되돌리기 (020 상태로) ──
-- 020_calendar_summary.sql 을 다시 실행한 뒤: drop function if exists calendar_headcount(date);
