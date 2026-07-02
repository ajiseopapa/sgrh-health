alter table races add column if not exists registration_status text; -- '접수중' | '접수마감' | '접수전'
alter table races add column if not exists external_id text; -- 크롤링 출처 사이트의 고유 id (중복 방지용)
create unique index if not exists idx_races_external_id on races(external_id) where external_id is not null;
