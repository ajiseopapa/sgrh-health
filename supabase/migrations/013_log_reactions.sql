-- ============================================================
-- 013_log_reactions.sql
-- 서로 칭찬하기: 피드의 운동 기록에 남기는 응원 리액션 (👏 💪 🔥)
-- 한 사람이 같은 기록에 같은 이모지를 두 번 누를 수 없도록 UNIQUE 제약을 겁니다.
-- (같은 기록에 👏 와 💪 를 함께 누르는 건 허용)
-- ============================================================

CREATE TABLE IF NOT EXISTS log_reactions (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  log_id      uuid        NOT NULL REFERENCES exercise_logs(id) ON DELETE CASCADE,
  employee_id uuid        NOT NULL REFERENCES employees(id)     ON DELETE CASCADE,
  emoji       text        NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE (log_id, employee_id, emoji)
);

ALTER TABLE log_reactions ENABLE ROW LEVEL SECURITY;

-- 다른 테이블들과 동일하게 DB 레벨 정책은 열어둡니다 (이 프로젝트의 기존 관례를 따름).
CREATE POLICY "log_reactions_select" ON log_reactions FOR SELECT USING (true);
CREATE POLICY "log_reactions_insert" ON log_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "log_reactions_delete" ON log_reactions FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS log_reactions_log_id_idx ON log_reactions(log_id);
