-- ============================================================
-- 022_hide_reaction_devices.sql — 응원 기기 식별값을 공개 읽기에서 숨김 (운영 후속 작업 지시서 작업 3)
-- ⚠️ 운영 실행은 PM 최종 승인 뒤. 순서: 새 버전 배포(피드가 /api/reactions/summary 로 읽음) → 이 SQL
--    (배포 전에 실행하면 지금 운영 화면의 피드에서 응원 숫자가 0으로 보입니다)
--
-- 왜: 지금은 공개 키로 log_reactions 를 통째로 읽을 수 있어, 모든 응원의 기기 식별값(device_id)이
--     누구에게나 보입니다. 그 값을 그대로 보내면 남의 응원을 끌 수 있습니다.
-- 무엇: 공개 읽기 정책만 지웁니다(운영에는 1개). 데이터(응원 행)·구조·유니크 인덱스는 그대로입니다.
--       화면은 서버 API(/api/reactions/summary)로 "응원 수 + 내가 눌렀는지"만 받습니다.
-- 여러 번 실행해도 결과 같음.
-- ============================================================

-- 이름과 상관없이 log_reactions 의 읽기(SELECT·ALL) 정책을 모두 지움
-- (운영 이름은 "log_reactions_select" 하나. 쓰기 정책은 019에서 이미 지워짐)
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'log_reactions' and cmd in ('SELECT', 'ALL')
  loop
    execute format('drop policy %I on log_reactions', p.policyname);
  end loop;
end $$;

-- 같은 기기·기록·이모지 1행 보장 인덱스가 있는지 확인 (013/014에서 만든 것, 없으면 중복 집계 위험)
create unique index if not exists log_reactions_device_uniq on log_reactions(log_id, device_id, emoji);

-- ── 확인 쿼리: 아래 두 줄이 나오면 정상 ──
--   policies = 0 (log_reactions 에 공개 정책 없음), uniq_index = 1, 응원 행 수는 실행 전과 같음
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'log_reactions') as policies,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'log_reactions_device_uniq') as uniq_index,
  (select count(*) from log_reactions) as reactions;

-- ── 되돌리기 ──
-- create policy "log_reactions_select" on log_reactions for select using (true);
