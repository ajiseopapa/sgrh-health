-- ============================================================
-- 035_reactions_by_employee.sql — 로그인한 직원의 응원은 "직원 기준"으로 한 번만
-- ⚠️ 운영은 PM 승인 뒤 TK님이 직접 실행(앱 배포 "전"에). 034 다음. 여러 번 실행해도 결과 같음.
--
-- 왜: 응원 중복을 기기 기준으로만 막아서, 같은 직원이 휴대폰과 PC에서 각각 누르면 2개로 세어집니다.
-- 무엇: "추가"만 합니다.
--  · employee_id 칸 추가(비어 있을 수 있음). 로그인한 직원의 응원에만 채워집니다.
--  · (기록, 직원, 이모지) 1행 보장 인덱스 추가 — 직원 칸이 채워진 줄에만 적용.
-- 바꾸지 않는 것:
--  · 기존 응원 줄(기기 기준)·응원 수 — 그대로.
--  · log_reactions_device_uniq — 손대지 않습니다. 지금 운영 앱이 이 인덱스로 저장(upsert)하므로
--    조건을 붙이거나 다시 만들면 응원 저장이 실패합니다(2026-11-18 사고 원인).
--  · 공개 정책 — 0개 그대로. 직원 칸은 서버(API)만 읽고, 화면에는 내려보내지 않습니다.
--
-- 옛 앱(기기 방식)은 이 SQL 실행 뒤에도 그대로 돌아갑니다(새 칸을 쓰지 않음).
-- ============================================================

alter table public.log_reactions
  add column if not exists employee_id uuid references public.employees(id) on delete cascade;

create unique index if not exists log_reactions_employee_uniq
  on public.log_reactions(log_id, employee_id, emoji)
  where employee_id is not null;

-- ── 확인 쿼리: 아래 한 줄이 나오면 정상 ──
--   policies = 0, device_uniq_full = 1 (조건 없는 인덱스 그대로), employee_uniq = 1,
--   reactions 는 실행 전과 같고, with_employee = 0 (새 앱 배포 전)
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'log_reactions') as policies,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'log_reactions_device_uniq'
     and indexdef not ilike '%where%') as device_uniq_full,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'log_reactions_employee_uniq') as employee_uniq,
  (select count(*) from public.log_reactions) as reactions,
  (select count(*) from public.log_reactions where employee_id is not null) as with_employee;

-- ── 되돌리기 (앱을 직전 배포로 되돌린 "뒤"에) ──
-- 주의: 새 앱이 저장한 직원 기준 응원(with_employee 건수)은 칸을 지우면 누가 눌렀는지 정보가 사라지고,
--       기기 값이 비어 있어 아무도 끌 수 없는 응원으로 남습니다. 깔끔히 하려면 먼저 그 줄을 지웁니다.
-- delete from public.log_reactions where employee_id is not null;
-- drop index if exists public.log_reactions_employee_uniq;
-- alter table public.log_reactions drop column if exists employee_id;
