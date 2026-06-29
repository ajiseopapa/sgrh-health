# 직원 운동 관리 프로그램

Next.js + Supabase + Vercel로 만든 모바일 최적화 팀 운동 트래커.

## 구조

```
app/
  layout.tsx        루트 레이아웃 (모바일 폭 고정, 뷰포트 설정)
  page.tsx          탭 네비게이션 (홈 / 통계 / 피드)
  globals.css
components/
  HomeTab.tsx        홈 탭: 데이터 페칭 + 하위 컴포넌트 조합
  TopRankingBoard.tsx  이번 달 TOP3 랭킹
  MiniCalendar.tsx     월간 미니 캘린더 (직원별 색상 점)
  ExerciseLogForm.tsx  이름 검색 + 운동 종목 선택 입력 폼
  StatsTab.tsx         통계 탭 (종목별/주간별 차트, 전체 랭킹)
  FeedTab.tsx          최근 운동 기록 피드
  SettingsPanel.tsx    ⚙️ 관리 화면 (직원 관리 / 운동 종목 관리 탭 전환)
  EmployeeManager.tsx      직원 등록/수정/삭제
  ExerciseTypeManager.tsx  운동 종목 등록/수정/삭제
lib/
  supabase.ts        Supabase 클라이언트
  colors.ts          직원ID -> 고정 색상 매핑 (캘린더/랭킹/피드 공통)
  dateUtils.ts        날짜/캘린더 그리드 유틸
types/
  database.ts        DB 타입 정의
supabase/
  schema.sql          테이블 생성 + RLS 정책 + 샘플 데이터
```

## 1. Supabase 설정

1. https://supabase.com 에서 새 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 내용을 그대로 실행
   - `exercise_types`, `employees`에 샘플 데이터가 들어갑니다. 실제 팀원 이름으로 바꿔주세요.
3. Project Settings > API에서 `Project URL`, `anon public key` 복사

## 2. 로컬 실행

```bash
npm install
cp .env.local.example .env.local
# .env.local에 위에서 복사한 URL/키 입력

npm run dev
```

`http://localhost:3000` 접속 (모바일 폭(max-w-md)으로 고정되어 있어서, 브라우저 창을 줄이거나 개발자도구의 모바일 뷰로 보면 실제 느낌과 같습니다.)

## 3. Vercel 배포

1. GitHub에 push
2. Vercel에서 New Project > 해당 repo import
3. Environment Variables에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가
4. Deploy

## 4. 직원 / 운동 종목 관리 (설정)

헤더 우측 상단의 ⚙️ 아이콘을 누르면 관리 화면이 열립니다.

- **직원 관리**: 이름 + 사번(선택) 등록, 수정, 삭제
- **운동 종목 관리**: 아이콘(이모지) + 이름 등록, 수정, 삭제

> ⚠️ 이미 `schema.sql`을 먼저 실행해두셨다면, `supabase/migrations/002_settings_panel.sql`을 추가로 실행해야 사번 컬럼과 수정/삭제 권한이 생깁니다. 처음 설치하는 경우라면 `schema.sql`에 이미 다 포함되어 있어서 따로 실행할 필요 없습니다.

직원을 삭제하면 그 직원의 운동 기록도 함께 삭제됩니다(연쇄 삭제). 운동 종목은 해당 종목으로 기록된 일지가 있으면 삭제가 막히고, 안내 메시지가 표시됩니다.

## 디자인/설계 메모

- **로그인 없음**: 내부용 도구라 이름 검색으로 본인을 선택하는 방식으로 단순화했습니다. 나중에 PIN이나 간단한 인증을 추가할 수 있습니다.
- **랭킹 기준**: "이번 달 기록 횟수"로 계산합니다 (시간/거리 기반으로 바꾸려면 `exercise_logs`에 `duration_minutes` 컬럼을 추가하고 TopRankingBoard의 집계 로직만 바꾸면 됩니다).
- **색상 점**: 직원 ID를 해시해서 고정 색상을 부여하므로, 캘린더/랭킹/피드 어디서든 같은 사람은 항상 같은 색으로 보입니다.
- **탭 구조**: 상단 헤더 + 하단 탭바(홈/통계/피드)로, 헤더 영역은 항상 고정해서 랭킹이 안 가려지게 했습니다.

## 다음에 추가하면 좋을 기능

- 직원 추가/관리 화면 (현재는 schema.sql로 직접 추가)
- 본인 인증 없이 누구나 입력 가능한 구조라 악의적 입력 방지용 간단한 잠금(예: 사내 IP 제한, 비밀 링크)
- 주간/월간 알림 (예: Slack 웹훅 연동)
