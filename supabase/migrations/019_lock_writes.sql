-- ============================================================
-- 019_lock_writes.sql — 브라우저 쓰기 차단 (v2 전환 2)
-- ⚠️ 전환 1 배포 후, 직원 PIN 등록이 끝난 다음에만 실행합니다.
--
-- 읽기(select) 정책은 그대로 두고, 저장·수정·삭제 정책만 지웁니다.
-- 이후 쓰기는 서버 API(service_role)만 가능합니다.
-- 예외: 건의함 "작성"은 지금처럼 브라우저에서 허용합니다.
-- ============================================================

-- ── 실행 전 확인: 지금 정책 목록 (캡처해 두세요. 되돌릴 때 기준) ──
select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 3, 2;

do $$
declare p record;
begin
  for p in
    select tablename, policyname, cmd from pg_policies
    where schemaname = 'public'
      and tablename in ('employees', 'exercise_types', 'exercise_logs', 'log_reactions',
                        'announcements', 'suggestions')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    if p.tablename = 'suggestions' and p.cmd = 'INSERT' then
      continue;  -- 건의 작성은 유지
    end if;
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;
end $$;

-- ── 확인 쿼리: 아래 결과는 suggestions INSERT 한 줄만 나와야 합니다 ──
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and cmd <> 'SELECT' order by 1;

-- ── 되돌리기 (예전처럼 전부 열기) ──
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['employees','exercise_types','exercise_logs','log_reactions','announcements'] loop
--     execute format('create policy "rollback insert" on %I for insert with check (true)', t);
--     execute format('create policy "rollback update" on %I for update using (true)', t);
--     execute format('create policy "rollback delete" on %I for delete using (true)', t);
--   end loop;
--   create policy "rollback update" on suggestions for update using (true);
--   create policy "rollback delete" on suggestions for delete using (true);
-- end $$;
