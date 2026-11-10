// 사용자 입력 검증
export const MAX_DURATION_SECONDS = 24 * 3600 // 저장 자체의 상한(하루). 목표·챌린지 반영 상한(300분)은 계산 단계에서 적용.
export const MAX_DISTANCE_KM = 500
export const MAX_MEMO = 300
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 오늘 날짜(Asia/Seoul) 'YYYY-MM-DD' */
export function todaySeoul(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function isValidDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export interface LogInput {
  exercise_type_id: string
  log_date: string
  duration_seconds: number
  duration_minutes: number
  distance_km: number | null
  memo: string | null
}

export function validateLogInput(body: Record<string, unknown> | null): { value: LogInput } | { error: string } {
  if (!body) return { error: '요청 형식이 올바르지 않아요.' }
  const typeId = String(body.exerciseTypeId ?? '')
  const logDate = String(body.logDate ?? '')
  const dur = Number(body.durationSeconds)
  const distRaw = body.distanceKm
  const memoRaw = body.memo

  if (!UUID_RE.test(typeId)) return { error: '운동 종목을 선택해주세요.' }
  if (!isValidDate(logDate)) return { error: '날짜가 올바르지 않아요.' }
  if (logDate > todaySeoul()) return { error: '미래 날짜로는 기록할 수 없어요.' }
  if (logDate < '2020-01-01') return { error: '날짜가 올바르지 않아요.' }
  if (!Number.isInteger(dur) || dur <= 0) return { error: '운동 시간을 입력해주세요.' }
  if (dur > MAX_DURATION_SECONDS) return { error: '운동 시간이 너무 길어요. 다시 확인해주세요.' }

  let distance: number | null = null
  if (distRaw !== null && distRaw !== undefined && distRaw !== '') {
    distance = Number(distRaw)
    if (!isFinite(distance) || distance < 0 || distance > MAX_DISTANCE_KM) return { error: '거리가 올바르지 않아요.' }
    distance = Math.round(distance * 100) / 100
    if (distance === 0) distance = null
  }

  let memo: string | null = null
  if (typeof memoRaw === 'string' && memoRaw.trim()) {
    memo = memoRaw.trim()
    if (memo.length > MAX_MEMO) return { error: `메모는 ${MAX_MEMO}자까지 쓸 수 있어요.` }
  }

  return {
    value: {
      exercise_type_id: typeId,
      log_date: logDate,
      duration_seconds: dur,
      duration_minutes: Math.round(dur / 60),
      distance_km: distance,
      memo,
    },
  }
}

export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t || t.length > max) return null
  return t
}
