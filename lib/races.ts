export interface Race {
  id: string
  name: string
  date: string // 'YYYY-MM-DD'
  location: string
  distances: string[]
  sourceName: string
  sourceUrl: string
}

// 부산 지역 마라톤/러닝 대회 목록 (수동 관리)
// 최신 정보는 각 sourceUrl에서 확인하세요. 새 대회는 이 배열에 추가하면 됩니다.
export const RACES: Race[] = [
  {
    id: 'taejongdae-2026',
    name: '제16회 태종대혹서기전국마라톤',
    date: '2026-07-19',
    location: '부산 태종대공원',
    distances: ['하프', '10km', '7km'],
    sourceName: '마라톤모아',
    sourceUrl: 'https://www.marathon.me.kr/events',
  },
  {
    id: 'night-race-busan-2026',
    name: '2026 나이트레이스 인 부산',
    date: '2026-08-01',
    location: '부산 광안리 해수욕장 → 벡스코',
    distances: ['7.21km'],
    sourceName: 'KorMarathon',
    sourceUrl: 'https://www.kormarathon.com/ko/marathon-calendar',
  },
  {
    id: 'theme-trail-run-2026',
    name: '제1회 테마임도 트레일런',
    date: '2026-08-08',
    location: '부산스포원',
    distances: ['50km'],
    sourceName: 'RunnerOn',
    sourceUrl: 'https://www.runneron.com/marathon',
  },
  {
    id: 'global-6k-water-busan-2026',
    name: '2026 글로벌 6K 포 워터 부산',
    date: '2026-10-03',
    location: '부산 다대포 해변공원',
    distances: ['6km', '10km'],
    sourceName: 'RunnerOn',
    sourceUrl: 'https://www.runneron.com/marathon',
  },
  {
    id: 'busan-sea-marathon-2026',
    name: '부산바다마라톤',
    date: '2026-12-06',
    location: '부산 광안리',
    distances: ['풀코스', '하프', '10km'],
    sourceName: 'RunnerOn',
    sourceUrl: 'https://www.runneron.com/marathon',
  },
  {
    id: 'oceanview-gijang-marathon-2027',
    name: '제9회 오션뷰 기장바다마라톤',
    date: '2027-04-18',
    location: '부산 오시리아',
    distances: ['하프', '10km', '3km(슬로우조깅)'],
    sourceName: 'RunnerOn',
    sourceUrl: 'https://www.runneron.com/marathon',
  },
]

export function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function formatRaceDate(dateStr: string): string {
  const d = new Date(dateStr)
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${weekdays[d.getDay()]})`
}
