-- 피드에서 운동 기록을 수정/삭제할 수 있도록 권한을 추가합니다.
-- 이미 schema.sql을 실행하신 경우, 이 파일만 추가로 실행하세요.

drop policy if exists "anon update logs" on exercise_logs;
create policy "anon update logs" on exercise_logs for update using (true);

drop policy if exists "anon delete logs" on exercise_logs;
create policy "anon delete logs" on exercise_logs for delete using (true);
