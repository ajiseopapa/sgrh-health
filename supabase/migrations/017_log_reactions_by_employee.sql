-- ============================================================
-- 017_log_reactions_by_employee.sql
-- 응원 중복을 "기기" 기준에서 "사람(직원)" 기준으로 전환.
-- 같은 사람이 휴대폰과 PC에서 각각 눌러도 1개로만 세기 위함입니다.
--
-- - employee_id 컬럼을 다시 추가합니다 (015에서 지웠던 자리).
-- - 기존 응원(직원 정보 없는 행)은 그대로 남고, 계속 기기 기준으로 중복을 막습니다.
-- - 새 응원은 (기록, 직원, 이모지) 조합이 하나만 들어갑니다.
--
-- 이 파일은 새 코드 배포 "전에" 실행해도 안전합니다 (기존 코드 동작 그대로).
-- ============================================================

ALTER TABLE log_reactions
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES employees(id) ON DELETE CASCADE;

-- 기기 기준 유니크는 직원 정보가 없는 예전 행에만 적용
DROP INDEX IF EXISTS log_reactions_device_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS log_reactions_device_uniq
  ON log_reactions(log_id, device_id, emoji)
  WHERE employee_id IS NULL;

-- 한 사람이 같은 기록에 같은 이모지를 한 번만
CREATE UNIQUE INDEX IF NOT EXISTS log_reactions_employee_uniq
  ON log_reactions(log_id, employee_id, emoji)
  WHERE employee_id IS NOT NULL;
