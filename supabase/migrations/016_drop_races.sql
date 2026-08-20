-- 016: 대회 기능 제거
-- 앱에서 대회 탭/관리 화면/크롤러를 모두 걷어냈으므로 테이블도 정리합니다.
-- ⚠️ 실행하면 races 테이블의 데이터가 전부 사라집니다. Supabase SQL Editor에서 직접 실행하세요.

drop table if exists races cascade;
