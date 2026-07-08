export interface Employee {
  id: string
  name: string
  employee_number: string
  color: string | null // 커스텀 색상 코드 (예: '#FF6B6B'). null이면 자동(해시) 색상 사용.
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  created_at: string
}

// 직원 건의함 — 직원이 관리자에게 남기는 요청/건의
export interface Suggestion {
  id: string
  employee_id: string | null      // 익명이면 null
  employee_name: string | null    // 표시용 이름 (익명이면 null)
  title: string
  content: string
  status: 'new' | 'read' | 'answered'
  admin_reply: string | null
  created_at: string
  replied_at: string | null
}

export interface EmployeeGoal {
  id: string
  employee_id: string
  year_month: string // 'YYYY-MM'
  goal_count: number
}

export interface ExerciseType {
  id: string
  name: string
  icon: string
  track_distance: boolean  // true면 거리·페이스 입력칸 표시
}

export interface ExerciseLog {
  id: string
  employee_id: string
  exercise_type_id: string
  log_date: string // 'YYYY-MM-DD'
  duration_minutes: number | null  // 구버전 호환용
  duration_seconds: number | null  // 신규 기준 (초)
  distance_km: number | null
  memo: string | null
  created_at: string
  employee?: Employee
  exercise_type?: ExerciseType
}

// duration_seconds 기반 페이스 계산
export function calcPace(
  durationSeconds: number,
  distanceKm: number,
  mode: 'min_per_km' | 'km_per_h' | 'min_per_100m'
): string {
  if (!durationSeconds || !distanceKm) return ''

  if (mode === 'km_per_h') {
    const speed = distanceKm / (durationSeconds / 3600)
    return `${speed.toFixed(1)} km/h`
  }
  if (mode === 'min_per_100m') {
    // 100m당 초
    const secPer100m = durationSeconds / (distanceKm * 10)
    const m = Math.floor(secPer100m / 60)
    const s = Math.round(secPer100m % 60)
    return `${m}'${String(s).padStart(2, '0')}"/100m`
  }
  // min_per_km (기본 · 러닝)
  const secPerKm = durationSeconds / distanceKm
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}'${String(s).padStart(2, '0')}"/km`
}

// 초 → "X시간 Xm Xs" 포맷
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h}시간`)
  if (m > 0) parts.push(`${m}분`)
  if (s > 0 || parts.length === 0) parts.push(`${s}초`)
  return parts.join(' ')
}

// 대회 정보 (races 테이블) — 관리자가 설정 화면에서 직접 등록/수정/삭제하거나 크롤링으로 채움
export interface Race {
  id: string
  name: string
  race_date: string // 'YYYY-MM-DD'
  location: string
  distances: string  // 쉼표로 구분된 문자열. 화면에서 표시할 땐 split(',')
  source_name: string | null
  source_url: string | null
  registration_deadline: string | null // 'YYYY-MM-DD', 수동 입력용. null이면 정보 없음
  registration_status: string | null   // '접수중' | '접수마감' | '접수전', 크롤링으로 채워짐
  external_id: string | null           // 크롤링 출처 사이트의 고유 id (중복 방지용)
  created_at: string
}
