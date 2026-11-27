-- ============================================================
-- 037_garden_guestbook.sql — 정원 방명록: 동료 정원에 놀러 가서 남기는 짧은 글
-- ⚠️ 운영은 TK님이 직접 실행. 배포 전·후 아무 때나 가능(실행 전 앱은 "방명록은 준비 중" 안내).
--    여러 번 실행해도 결과 같음.
--
-- 원칙
--  · 기존 테이블·데이터는 바꾸지 않습니다(새 테이블 1개).
--  · 글은 100자 이내 한 줄. 쓴 사람(author)은 본인 확인한 직원, 정원 주인(owner)은 직원.
--  · 지우기는 쓴 사람·정원 주인·관리자만(서버 API가 판단).
--  · 서버(service_role)만 접근: RLS 켜고 정책 없음 + 공개 역할 권한 회수.
-- 되돌리기: drop table if exists public.garden_guestbook;
-- ============================================================

create table if not exists public.garden_guestbook (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.employees(id) on delete cascade,
  author_id  uuid not null references public.employees(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 100),
  created_at timestamptz not null default now()
);

create index if not exists garden_guestbook_owner_idx on public.garden_guestbook (owner_id, created_at desc);

alter table public.garden_guestbook enable row level security;
revoke all on table public.garden_guestbook from anon, authenticated;

-- 확인: 표 1개, 정책 0개, 공개 역할 권한 0개
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'garden_guestbook') as has_table,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'garden_guestbook') as policies,
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'garden_guestbook' and grantee in ('anon', 'authenticated')) as public_grants;
