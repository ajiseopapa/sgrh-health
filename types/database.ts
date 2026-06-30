export interface Employee {
  id: string
  name: string
  employee_number: string
  created_at: string
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
  duration_minutes: number | null
  distance_km: number | null
  memo: string | null
  created_at: string
  employee?: Employee
  exercise_type?: ExerciseType
}

// 페이스 계산 유틸 (러닝·수영은 min/km, 자전거는 km/h)
export function calcPace(
  durationMinutes: number,
  distanceKm: number,
  mode: 'min_per_km' | 'km_per_h' | 'min_per_100m'
): string {
  if (!durationMinutes || !distanceKm) return ''
  if (mode === 'km_per_h') {
    const speed = distanceKm / (durationMinutes / 60)
    return `${speed.toFixed(1)} km/h`
  }
  if (mode === 'min_per_100m') {
    const minPer100m = durationMinutes / (distanceKm * 10)
    const m = Math.floor(minPer100m)
    const s = Math.round((minPer100m - m) * 60)
    return `${m}'${String(s).padStart(2, '0')}"/100m`
  }
  // min_per_km (기본 · 러닝)
  const minPerKm = durationMinutes / distanceKm
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60)
  return `${m}'${String(s).padStart(2, '0')}"/km`
}
