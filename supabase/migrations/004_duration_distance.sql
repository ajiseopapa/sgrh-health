-- ============================================================
-- 004: 운동 시간, 거리, 페이스 지원
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- exercise_logs에 시간/거리 컬럼 추가
alter table exercise_logs
  add column if not exists duration_minutes integer,       -- 운동 시간 (분)
  add column if not exists distance_km      numeric(6,2);  -- 거리 (km)

-- exercise_types에 거리 추적 여부 플래그 추가
alter table exercise_types
  add column if not exists track_distance boolean not null default false;

-- 기존 종목 중 거리 추적이 필요한 것들에 미리 true 설정
-- (이름에 해당 키워드가 있는 경우 자동 적용 — 틀리면 설정에서 수동 조정)
update exercise_types
set track_distance = true
where name ilike any(array['%러닝%','%달리기%','%수영%','%자전거%','%사이클%','%마라톤%','%트레일%','%조깅%']);
