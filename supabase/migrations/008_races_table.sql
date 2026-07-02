-- ============================================================
-- 008: 대회 정보 테이블 (races)
-- 정적 파일(lib/races.ts)로 관리하던 대회 목록을 DB로 옮겨서
-- 관리자가 설정 화면에서 직접 추가/수정/삭제할 수 있게 합니다.
-- ============================================================

create table if not exists races (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  race_date date not null,
  location text not null,
  distances text not null,       -- 쉼표로 구분된 문자열 (예: "하프,10km,7km")
  source_name text,
  source_url text,
  created_at timestamptz default now()
);

create index if not exists idx_races_date on races(race_date);

alter table races enable row level security;

drop policy if exists "anon read races" on races;
create policy "anon read races" on races for select using (true);
drop policy if exists "anon insert races" on races;
create policy "anon insert races" on races for insert with check (true);
drop policy if exists "anon update races" on races;
create policy "anon update races" on races for update using (true);
drop policy if exists "anon delete races" on races;
create policy "anon delete races" on races for delete using (true);

-- 기존에 정적으로 관리하던 부산 대회 6건을 시드 데이터로 이관
insert into races (name, race_date, location, distances, source_name, source_url) values
  ('제16회 태종대혹서기전국마라톤', '2026-07-19', '부산 태종대공원', '하프,10km,7km', '마라톤모아', 'https://www.marathon.me.kr/events'),
  ('2026 나이트레이스 인 부산', '2026-08-01', '부산 광안리 해수욕장 → 벡스코', '7.21km', 'KorMarathon', 'https://www.kormarathon.com/ko/marathon-calendar'),
  ('제1회 테마임도 트레일런', '2026-08-08', '부산스포원', '50km', 'RunnerOn', 'https://www.runneron.com/marathon'),
  ('2026 글로벌 6K 포 워터 부산', '2026-10-03', '부산 다대포 해변공원', '6km,10km', 'RunnerOn', 'https://www.runneron.com/marathon'),
  ('부산바다마라톤', '2026-12-06', '부산 광안리', '풀코스,하프,10km', 'RunnerOn', 'https://www.runneron.com/marathon'),
  ('제9회 오션뷰 기장바다마라톤', '2027-04-18', '부산 오시리아', '하프,10km,3km(슬로우조깅)', 'RunnerOn', 'https://www.runneron.com/marathon')
on conflict do nothing;
