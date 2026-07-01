-- 007: 직원별 커스텀 색상 코드
-- 관리자 설정 > 직원 관리에서 직원마다 색상을 직접 지정할 수 있게 합니다.
-- 값이 비어있으면(null) 기존처럼 ID 해시 기반 자동 색상을 사용합니다.

alter table employees
  add column if not exists color text;

comment on column employees.color is '캘린더/랭킹/피드에서 사용할 커스텀 색상 코드 (예: #FF6B6B). null이면 자동 색상 사용.';
