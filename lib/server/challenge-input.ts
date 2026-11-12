// 챌린지 입력 검증 (관리자 생성·수정 공용)
import { cleanText, isValidDate } from './validate'

export const METRICS = ['sessions', 'minutes', 'active_days'] as const

export function parseChallenge(body: Record<string, unknown> | null) {
  const title = cleanText(body?.title, 40)
  const description = cleanText(body?.description ?? '', 200)
  const metric = String(body?.metric ?? '')
  const target = Number(body?.target)
  const start_date = String(body?.startDate ?? '')
  const end_date = String(body?.endDate ?? '')
  if (!title) return { error: '챌린지 이름을 입력해주세요.' }
  if (!(METRICS as readonly string[]).includes(metric)) return { error: '목표 기준을 골라주세요.' }
  if (!Number.isInteger(target) || target < 1 || target > 100000) return { error: '목표 값을 숫자로 입력해주세요.' }
  if (!isValidDate(start_date) || !isValidDate(end_date)) return { error: '기간을 다시 골라주세요.' }
  if (end_date < start_date) return { error: '종료일이 시작일보다 앞서요.' }
  return { value: { title, description: description || null, metric, target, start_date, end_date } }
}

