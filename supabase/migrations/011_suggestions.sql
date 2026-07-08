-- ============================================================
-- 011_suggestions.sql
-- 직원 건의함: 직원 -> 관리자 요청/건의 게시판
-- ============================================================

CREATE TABLE IF NOT EXISTS suggestions (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id    uuid        REFERENCES employees(id) ON DELETE SET NULL,
  employee_name  text,                          -- 표시용 (익명이면 NULL)
  title          text        NOT NULL,
  content        text        NOT NULL,
  status         text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'answered')),
  admin_reply    text,
  created_at     timestamptz DEFAULT now() NOT NULL,
  replied_at     timestamptz
);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

-- 다른 테이블들과 동일하게, 앱 자체 관리자 비밀번호로 게이팅하고
-- DB 레벨 정책은 열어둡니다 (이 프로젝트의 기존 관례를 따름).
CREATE POLICY "suggestions_select" ON suggestions FOR SELECT USING (true);
CREATE POLICY "suggestions_insert" ON suggestions FOR INSERT WITH CHECK (true);
CREATE POLICY "suggestions_update" ON suggestions FOR UPDATE USING (true);
CREATE POLICY "suggestions_delete" ON suggestions FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS suggestions_status_idx ON suggestions(status);
CREATE INDEX IF NOT EXISTS suggestions_created_at_idx ON suggestions(created_at DESC);
