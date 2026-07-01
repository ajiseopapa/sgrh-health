# 기존 파일 수정 가이드

이 파일들은 직접 수정이 필요합니다. 아래 패치를 순서대로 적용하세요.

---

## 1. types/database.ts

파일 끝에 아래 두 인터페이스 추가:

```ts
export interface Announcement {
  id: string
  title: string
  content: string
  created_at: string
}

export interface EmployeeGoal {
  id: string
  employee_id: string
  year_month: string   // 'YYYY-MM'
  goal_count: number
}
```

---

## 2. app/page.tsx

### 2-1. import 추가 (기존 import 블록 끝에)

```tsx
import AnnouncementsModal, { useHasUnreadAnnouncements } from '@/components/AnnouncementsModal'
```

### 2-2. 컴포넌트 최상단 state/hook 추가

기존 `isAdmin`, `showSettings` 같은 state 선언 근처에 추가:

```tsx
const [showAnnouncements, setShowAnnouncements] = useState(false)
const hasUnread = useHasUnreadAnnouncements()
```

### 2-3. 헤더에 📢 버튼 추가

헤더에 있는 ⚙️ 버튼 바로 **왼쪽**에 추가:

```tsx
{/* 📢 업데이트 내역 버튼 */}
<button
  onClick={() => setShowAnnouncements(true)}
  className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
>
  <span className="text-lg">📢</span>
  {hasUnread && (
    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
  )}
</button>
```

### 2-4. JSX return 끝부분 (탭바 아래)에 모달 추가

```tsx
<AnnouncementsModal
  isOpen={showAnnouncements}
  onClose={() => setShowAnnouncements(false)}
  isAdmin={isAdmin}
/>
```

---

## 3. components/HomeTab.tsx

### 3-1. import 추가

```tsx
import GoalProgress from '@/components/GoalProgress'
import StreakBadge from '@/components/StreakBadge'
```

### 3-2. Props에 isAdmin 추가

```tsx
interface HomeTabProps {
  // ... 기존 props
  isAdmin: boolean
}
```

(그리고 app/page.tsx에서 HomeTab에 isAdmin={isAdmin} 전달)

### 3-3. 선택된 직원이 있을 때 GoalProgress + StreakBadge 렌더링

ExerciseLogForm 위 또는 MiniCalendar 아래에 추가.
`selectedEmployee`는 기존 코드에서 직원을 선택했을 때 set되는 state 변수명으로 교체하세요.

```tsx
{selectedEmployee && (
  <>
    <StreakBadge employeeId={selectedEmployee.id} />
    <GoalProgress
      employeeId={selectedEmployee.id}
      currentCount={thisMonthCount}   // 이미 계산된 이번 달 횟수 변수명으로 교체
      isAdmin={isAdmin}
    />
  </>
)}
```

> **thisMonthCount**: HomeTab에서 이미 계산한 "이번 달 해당 직원의 기록 수" 값을 쓰면 됩니다.
> 없다면 아래처럼 계산:
> ```tsx
> const thisMonthCount = exerciseLogs.filter(log =>
>   log.employee_id === selectedEmployee?.id &&
>   log.logged_date.startsWith(new Date().toISOString().slice(0, 7))
> ).length
> ```

---

## 4. 완료 후 체크리스트

- [ ] Supabase SQL Editor에서 `004_motivation_announcements.sql` 실행
- [ ] `types/database.ts` 타입 추가
- [ ] `AnnouncementsModal.tsx`, `GoalProgress.tsx`, `StreakBadge.tsx` 파일 복사
- [ ] `app/page.tsx` 수정 (import + state + 버튼 + 모달)
- [ ] `components/HomeTab.tsx` 수정 (import + 조건부 렌더)
- [ ] Vercel 재배포 (환경변수 추가 없음 — 기존 Supabase 키 그대로 사용)
