-- 006: 운동 시간을 초 단위로 저장
-- duration_minutes는 기존 데이터 보존용으로 유지, 신규 기록은 duration_seconds에 저장합니다.

alter table exercise_logs
  add column if not exists duration_seconds integer;

-- 기존 minutes 데이터를 seconds로 변환해서 채워두기
update exercise_logs
set duration_seconds = duration_minutes * 60
where duration_minutes is not null and duration_seconds is null;
