// 배지 정의(화면·서버 공용). 지급 조건·ID 는 v2.1 그대로 — 여기서 바꾸지 마세요(engagement.ts 가 재사용).
export interface BadgeDef { key: string; series: 'sessions' | 'streak' | 'goalweeks'; threshold: number; label: string; condition: string }
export const BADGES: BadgeDef[] = [
  { key: 'sessions_1', series: 'sessions', threshold: 1, label: '첫 기록', condition: '운동 기록 1회' },
  { key: 'sessions_10', series: 'sessions', threshold: 10, label: '열 번째', condition: '누적 운동 기록 10회' },
  { key: 'sessions_30', series: 'sessions', threshold: 30, label: '서른 번', condition: '누적 운동 기록 30회' },
  { key: 'sessions_100', series: 'sessions', threshold: 100, label: '백 번', condition: '누적 운동 기록 100회' },
  { key: 'streak_3', series: 'streak', threshold: 3, label: '3일 연속', condition: '3일 연속 운동' },
  { key: 'streak_7', series: 'streak', threshold: 7, label: '일주일 연속', condition: '7일 연속 운동' },
  { key: 'streak_14', series: 'streak', threshold: 14, label: '2주 연속', condition: '14일 연속 운동' },
  { key: 'streak_30', series: 'streak', threshold: 30, label: '한 달 연속', condition: '30일 연속 운동' },
  { key: 'goalweeks_1', series: 'goalweeks', threshold: 1, label: '목표 달성', condition: '주간 목표 1회 달성' },
  { key: 'goalweeks_4', series: 'goalweeks', threshold: 4, label: '목표 4주', condition: '주간 목표 4회 달성' },
  { key: 'goalweeks_12', series: 'goalweeks', threshold: 12, label: '목표 12주', condition: '주간 목표 12회 달성' },
]
export const SERIES_LABEL = { sessions: '누적 기록', streak: '연속 운동', goalweeks: '목표 달성' } as const
export const SERIES_UNIT = { sessions: '회', streak: '일', goalweeks: '주' } as const

/** 배지 ID → 픽셀 아트 파일(public/game/v22/badges). scripts/make-game-art.py 의 BADGE_FILE 과 같음 */
export const BADGE_ART: Record<string, string> = {
  sessions_1: 'record-01', sessions_10: 'record-10', sessions_30: 'record-30', sessions_100: 'record-100',
  streak_3: 'streak-03', streak_7: 'streak-07', streak_14: 'streak-14', streak_30: 'streak-30',
  goalweeks_1: 'goal-01', goalweeks_4: 'goal-04', goalweeks_12: 'goal-12',
}
export const badgeSrc = (key: string) => `/game/v22/badges/${BADGE_ART[key]}.png`
