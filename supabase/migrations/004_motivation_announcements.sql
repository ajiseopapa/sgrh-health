-- ============================================================
-- 004_motivation_announcements.sql
-- 업데이트 내역(announcements) + 월별 목표(employee_goals) 테이블
-- ============================================================

-- 업데이트 내역
CREATE TABLE IF NOT EXISTS announcements (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text        NOT NULL,
  content     text        NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select" ON announcements FOR SELECT USING (true);
CREATE POLICY "announcements_insert" ON announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "announcements_update" ON announcements FOR UPDATE USING (true);
CREATE POLICY "announcements_delete" ON announcements FOR DELETE USING (true);

-- 직원별 월간 목표
CREATE TABLE IF NOT EXISTS employee_goals (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id  uuid    NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year_month   text    NOT NULL,          -- 'YYYY-MM'
  goal_count   integer NOT NULL DEFAULT 12,
  UNIQUE(employee_id, year_month)
);

ALTER TABLE employee_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select" ON employee_goals FOR SELECT USING (true);
CREATE POLICY "goals_insert" ON employee_goals FOR INSERT WITH CHECK (true);
CREATE POLICY "goals_update" ON employee_goals FOR UPDATE USING (true);
CREATE POLICY "goals_delete" ON employee_goals FOR DELETE USING (true);
