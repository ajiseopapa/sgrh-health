-- 012: races.external_id 유니크 인덱스 수정
--
-- 문제: 010에서 만든 인덱스가 부분(partial) 인덱스였습니다.
--   create unique index ... on races(external_id) where external_id is not null;
--
-- Supabase JS의 upsert(rows, { onConflict: 'external_id' })는 WHERE 조건을 붙일 수 없어서
--   ON CONFLICT (external_id) DO UPDATE ...
-- 형태로만 쿼리를 만드는데, 이게 부분 인덱스와 매칭되지 않아
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- 에러가 발생했습니다.
--
-- 해결: WHERE 조건 없는 완전 유니크 인덱스로 교체합니다.
-- (Postgres는 NULL끼리 서로 다른 값으로 취급하므로, external_id가 NULL인 행이 여러 개 있어도
--  유니크 제약에 걸리지 않습니다.)

drop index if exists idx_races_external_id;
create unique index if not exists idx_races_external_id on races(external_id);
