-- ============================================================
-- 014_log_reactions_anonymous.sql
-- 응원을 익명(기기 기준)으로 전환.
-- 누를 때 이름을 물어보는 모달을 없애기 위해, 누가 눌렀는지 대신
-- "어느 기기에서 눌렀는지"만 기억합니다. (같은 기기에서 다시 누르면 취소)
--
-- employee_id 컬럼은 지우지 않고 nullable로만 바꿔둡니다.
-- 나중에 "누가 응원했는지"를 다시 보여주고 싶어질 때를 위해 남겨둔 자리입니다.
-- ============================================================

ALTER TABLE log_reactions ALTER COLUMN employee_id DROP NOT NULL;

ALTER TABLE log_reactions ADD COLUMN IF NOT EXISTS device_id text;

-- 기존 (log_id, employee_id, emoji) 유니크 제약은 더 이상 쓰지 않습니다.
ALTER TABLE log_reactions DROP CONSTRAINT IF EXISTS log_reactions_log_id_employee_id_emoji_key;

-- 한 기기가 같은 기록에 같은 이모지를 두 번 넣지 못하도록.
CREATE UNIQUE INDEX IF NOT EXISTS log_reactions_device_uniq
  ON log_reactions(log_id, device_id, emoji);
