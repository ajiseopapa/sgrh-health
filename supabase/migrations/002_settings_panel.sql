-- 이미 schema.sql을 한 번 실행하셨다면, 이 파일만 추가로 실행하세요.
-- (사번 컬럼 추가 + 설정 화면에서 수정/삭제가 가능하도록 RLS 정책 추가)

alter table employees drop constraint if exists employees_name_key;
alter table employees add column if not exists employee_number text unique;

drop policy if exists "anon update employees" on employees;
create policy "anon update employees" on employees for update using (true);

drop policy if exists "anon delete employees" on employees;
create policy "anon delete employees" on employees for delete using (true);

drop policy if exists "anon insert types" on exercise_types;
create policy "anon insert types" on exercise_types for insert with check (true);

drop policy if exists "anon update types" on exercise_types;
create policy "anon update types" on exercise_types for update using (true);

drop policy if exists "anon delete types" on exercise_types;
create policy "anon delete types" on exercise_types for delete using (true);
