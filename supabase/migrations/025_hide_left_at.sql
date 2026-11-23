-- ============================================================
-- 025_hide_left_at.sql — 퇴사일(employees.left_at) 공개 조회 차단 (v2.1 P1-1)
-- ⚠️ 시험 DB 전용. 운영 실행은 PM 승인 뒤, 024 다음에. 여러 번 실행해도 결과 같음. 데이터 변경 없음.
--
-- 무엇: 공개 역할(anon·authenticated)의 employees 읽기 권한을 "칸 단위"로 바꿉니다.
--   화면에 필요한 칸(id, name, employee_number, color, created_at)만 읽을 수 있고, left_at 은 읽을 수 없습니다.
--   서버(service_role)는 그대로 전부 읽습니다(퇴사 판단·관리자 화면).
-- 함께: 달력 분모 함수 calendar_headcount 는 left_at 을 봐야 하므로 security definer 로 바꿉니다.
--   (돌려주는 값은 인원 수뿐이라 퇴사일 자체는 나가지 않음. search_path 고정)
-- 주의: 공개 키로 employees 를 select('*') 하면 이제 권한 오류가 납니다. 화면 코드는 필요한 칸만 고르도록 바꿨습니다.
-- ============================================================

revoke select on table public.employees from anon, authenticated;
grant select (id, name, employee_number, color, created_at) on table public.employees to anon, authenticated;

create or replace function calendar_headcount(p_day date)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'count', nullif(count(*)::int, 0),
    'basis', 'registered'
  )
  from employees e
  where e.created_at < ((p_day + 1)::timestamp at time zone 'Asia/Seoul')
    and (e.left_at is null or e.left_at >= p_day)
$$;

revoke all on function calendar_headcount(date) from public;
grant execute on function calendar_headcount(date) to anon, authenticated, service_role;

-- ── 확인 쿼리: anon 이 left_at 은 못 읽고(false) 이름은 읽음(true), 달력 함수는 실행 가능(true) ──
select
  has_column_privilege('anon', 'public.employees', 'left_at', 'select') as anon_left_at,
  has_column_privilege('anon', 'public.employees', 'name', 'select') as anon_name,
  has_function_privilege('anon', 'public.calendar_headcount(date)', 'execute') as anon_calendar;

-- ── 되돌리기 ──
-- grant select on table public.employees to anon, authenticated;
-- 그리고 024 의 calendar_headcount 정의(security invoker)를 다시 실행
