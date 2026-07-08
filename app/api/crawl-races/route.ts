import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// 여러 소스에서 '부산' 지역 대회만 모아서 저장합니다.
// 소스 하나가 실패해도 나머지는 계속 진행하도록 소스별로 try/catch 처리합니다.
// (calRUNdar는 지도 기반 SPA라 정적 HTML에 데이터가 없어 제외했습니다 - 별도 API 조사가 필요합니다.)

const LOCATION_KEYWORD = '부산'

interface ParsedRace {
  external_id: string
  name: string
  race_date: string // YYYY-MM-DD
  location: string
  distances: string
  registration_status: string
  source_url: string
  source_name: string
}

interface SourceResult {
  source: string
  ok: boolean
  count: number
  error?: string
}

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

// 장소 문자열 뒤에 거리 정보가 공백 없이 이어붙어 있어서, 아래 패턴으로 경계를 찾습니다.
const DISTANCE_TOKEN =
  /(풀코스|Full|하프|Half|\d+(?:\.\d+)?\s?[kK][mM]|\d+\s?K(?!m)|가족런|커플런|마니아|워킹|릴레이|걷기|구간마라톤|단체런[^,·]*|슬로우조깅)/g

function splitLocationAndDistances(text: string): { location: string; distances: string } {
  const matches = [...text.matchAll(DISTANCE_TOKEN)]
  if (matches.length === 0) return { location: text.trim(), distances: '' }
  const firstIdx = matches[0].index ?? text.length
  return {
    location: text.slice(0, firstIdx).trim(),
    distances: matches.map((m) => m[0].trim()).join(','),
  }
}

// 'YYYY-MM-DD' (Asia/Seoul 기준)
function getSeoulYMD() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  return {
    y: Number(parts.find((p) => p.type === 'year')?.value),
    m: Number(parts.find((p) => p.type === 'month')?.value),
    d: Number(parts.find((p) => p.type === 'day')?.value),
  }
}

// 오늘(Asia/Seoul) 기준 D-day를 실제 YYYY-MM-DD로 변환
function addDaysToSeoulToday(days: number): string {
  const { y, m, d } = getSeoulYMD()
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() + days)
  const yy = base.getUTCFullYear()
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(base.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// ────────────────────────────────────────────────────────────
// 1. 마라톤모아 (marathon.me.kr) - 기존 로직 그대로
// ────────────────────────────────────────────────────────────
function parseMarathonMoaCard(cardText: string, href: string): ParsedRace | null {
  const idMatch = href.match(/\/events\/([a-f0-9-]+)/)
  if (!idMatch) return null

  const statusMatch = cardText.match(/(접수중|접수마감|접수전)/)
  const registration_status = statusMatch ? statusMatch[1] : '알수없음'

  const dateMatch = cardText.match(/일시(\d{4})\.(\d{2})\.(\d{2})\./)
  if (!dateMatch) return null
  const race_date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`

  const afterLocation = cardText.split('장소')[1]
  if (!afterLocation) return null

  const { location, distances } = splitLocationAndDistances(afterLocation)

  const nameMatch = cardText.match(/(접수중|접수마감|접수전)([^]*?)일시/)
  const name = nameMatch ? nameMatch[2].trim() : ''

  if (!name || !location) return null

  return {
    external_id: idMatch[1],
    name,
    race_date,
    location,
    distances,
    registration_status,
    source_url: href.startsWith('http') ? href : `https://marathon.me.kr${href}`,
    source_name: '마라톤모아',
  }
}

async function crawlMarathonMoa(): Promise<ParsedRace[]> {
  const res = await fetch('https://marathon.me.kr/events', { cache: 'no-store', headers: FETCH_HEADERS })
  const html = await res.text()
  const $ = cheerio.load(html)

  const results: ParsedRace[] = []
  $('a[href^="/events/"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const cardText = $(el).text().replace(/\s+/g, ' ').trim()
    if (!cardText.includes(LOCATION_KEYWORD)) return
    const parsed = parseMarathonMoaCard(cardText, href)
    if (parsed) results.push(parsed)
  })
  return dedupeById(results)
}

// ────────────────────────────────────────────────────────────
// 2. 마라톤메이트 (marathonmate.store) - region=부산 필터 + 실제 <table> 파싱
// ────────────────────────────────────────────────────────────
async function crawlMarathonMate(): Promise<ParsedRace[]> {
  const res = await fetch('https://marathonmate.store/domestic?region=%EB%B6%80%EC%82%B0', {
    cache: 'no-store',
    headers: FETCH_HEADERS,
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  const results: ParsedRace[] = []
  $('table tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 5) return // 헤더 행(th)이거나 구조가 다른 행은 스킵

    const race_date = $(cells[0]).text().trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(race_date)) return

    const link = $(cells[1]).find('a').first()
    const name = link.text().trim()
    const href = link.attr('href') ?? ''
    const idMatch = href.match(/\/race\/([a-f0-9-]+)/)
    if (!idMatch || !name) return

    const locationRaw = $(cells[2]).text().trim() // "부산 · 장소" 형태
    const location = locationRaw.includes('·')
      ? locationRaw.split('·').slice(1).join('·').trim()
      : locationRaw

    const distances = $(cells[3]).text().trim().replace(/\s*·\s*/g, ',')
    const registration_status = $(cells[4]).text().trim() || '알수없음'

    results.push({
      external_id: `mate:${idMatch[1]}`,
      name,
      race_date,
      location,
      distances,
      registration_status,
      source_url: href.startsWith('http') ? href : `https://marathonmate.store${href}`,
      source_name: '마라톤메이트',
    })
  })
  return dedupeById(results)
}

// ────────────────────────────────────────────────────────────
// 3. 러너온 (runneron.com) - region=부산 필터 + 카드 텍스트 파싱
//    카드 접수 상태 표기가 없어 registration_status는 '정보없음' 고정
// ────────────────────────────────────────────────────────────
async function crawlRunnerOn(): Promise<ParsedRace[]> {
  const res = await fetch('https://www.runneron.com/marathon?region=%EB%B6%80%EC%82%B0&distance=%EC%A0%84%EC%B2%B4', {
    cache: 'no-store',
    headers: FETCH_HEADERS,
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  const results: ParsedRace[] = []
  $('a[href*="/marathon/"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (href.includes('/marathon/calendar') || href.includes('/marathon/favorites')) return
    const slugMatch = href.match(/\/marathon\/([^/?#]+)/)
    if (!slugMatch) return
    const slug = slugMatch[1]

    const cardText = $(el).text().replace(/\s+/g, ' ').trim()
    const dDayMatch = cardText.match(/D-(\d+)/)
    const nameMatch = cardText.match(/^\d{2}\.\d{2}\s*[월화수목금토일]?\s*(.+?)\s*대회 포스터/)
    if (!dDayMatch || !nameMatch) return

    const name = nameMatch[1].trim()
    if (!name) return

    const race_date = addDaysToSeoulToday(Number(dDayMatch[1]))

    // 카드 텍스트 안에 이름이 두 번(이미지 alt / 제목) 나오므로, 두 번째 등장 이후부터가 장소·거리 정보
    const firstIdx = cardText.indexOf(name)
    const secondIdx = cardText.indexOf(name, firstIdx + name.length)
    const rest = secondIdx >= 0 ? cardText.slice(secondIdx + name.length) : ''
    const restTrimmed = rest.replace(/대회\s*정보[·ㆍ]입상자[·ㆍ]후기\s*→?\s*$/, '').trim()

    const { location, distances } = splitLocationAndDistances(restTrimmed)
    if (!location) return

    results.push({
      external_id: `runneron:${slug}`,
      name,
      race_date,
      location,
      distances,
      registration_status: '정보없음',
      source_url: href.startsWith('http') ? href : `https://www.runneron.com${href}`,
      source_name: '러너온',
    })
  })
  return dedupeById(results)
}

// ────────────────────────────────────────────────────────────
// 4. KorMarathon (kormarathon.com) - 부산 지역 전용 페이지
// ────────────────────────────────────────────────────────────
async function crawlKorMarathon(): Promise<ParsedRace[]> {
  const res = await fetch('https://www.kormarathon.com/ko/marathons/regions/busan', {
    cache: 'no-store',
    headers: FETCH_HEADERS,
  })
  const html = await res.text()
  const $ = cheerio.load(html)

  const results: ParsedRace[] = []
  $('a[href*="/ko/races/"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const slugMatch = href.match(/\/ko\/races\/([^/?#]+)/)
    if (!slugMatch) return
    const slug = slugMatch[1]

    const cardText = $(el).text().replace(/\s+/g, ' ').trim()
    const dateMatch = cardText.match(/(\d{4})\.(\d{2})\.(\d{2})/)
    if (!dateMatch) return
    const race_date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`

    const afterDate = cardText
      .slice(cardText.indexOf(dateMatch[0]) + dateMatch[0].length)
      .replace(/^[월화수목금토일]/, '')
      .replace(/^(접수중|접수마감|마감|접수예정|접수일 미정|신청 가능)\s*/, '')
      .trim()

    // '지역·' 마커(예: '부산·') 기준으로 이름 / 장소·거리를 나눈다
    const marker = `${LOCATION_KEYWORD}·`
    const markerIdx = afterDate.indexOf(marker)
    if (markerIdx === -1) return
    const name = afterDate.slice(0, markerIdx).trim()
    if (!name) return
    const rest = afterDate.slice(markerIdx + marker.length) // 예: "부산 태종대공원 7km, 14km, Half 마감"

    const { location, distances: rawDistances } = splitLocationAndDistances(rest)
    const distances = rawDistances.replace(/,?\s*(접수중|접수마감|마감|접수예정|접수일 미정|신청 가능)\s*$/, '')

    const statusMatch = cardText.match(/(접수중|접수마감|마감|접수예정|접수일 미정|신청 가능)\s*$/)
    const registration_status = statusMatch ? statusMatch[1] : '알수없음'

    results.push({
      external_id: `kormarathon:${slug}`,
      name,
      race_date,
      location: location || '부산',
      distances,
      registration_status,
      source_url: href.startsWith('http') ? href : `https://www.kormarathon.com${href}`,
      source_name: 'KorMarathon',
    })
  })
  return dedupeById(results)
}

function dedupeById(races: ParsedRace[]): ParsedRace[] {
  const seen = new Set<string>()
  return races.filter((r) => {
    if (seen.has(r.external_id)) return false
    seen.add(r.external_id)
    return true
  })
}

const SOURCES: { name: string; run: () => Promise<ParsedRace[]> }[] = [
  { name: '마라톤모아', run: crawlMarathonMoa },
  { name: '마라톤메이트', run: crawlMarathonMate },
  { name: '러너온', run: crawlRunnerOn },
  { name: 'KorMarathon', run: crawlKorMarathon },
]

async function crawlAll(): Promise<{ races: ParsedRace[]; sources: SourceResult[] }> {
  const settled = await Promise.allSettled(SOURCES.map((s) => s.run()))

  const races: ParsedRace[] = []
  const sources: SourceResult[] = []

  settled.forEach((result, i) => {
    const name = SOURCES[i].name
    if (result.status === 'fulfilled') {
      races.push(...result.value)
      sources.push({ source: name, ok: true, count: result.value.length })
    } else {
      sources.push({
        source: name,
        ok: false,
        count: 0,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      })
    }
  })

  return { races: dedupeById(races), sources }
}

// GET: 미리보기만 (DB 저장 안 함). sources 필드로 소스별 성공/실패·건수를 확인할 수 있습니다.
export async function GET() {
  try {
    const { races, sources } = await crawlAll()
    return NextResponse.json({ ok: true, count: races.length, sources, races })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: 500 })
  }
}

// POST: 실제로 Supabase에 저장 (미리보기에서 확인한 리스트를 그대로 전달받음)
export async function POST(req: NextRequest) {
  try {
    const { races } = (await req.json()) as { races: ParsedRace[] }
    if (!Array.isArray(races) || races.length === 0) {
      return NextResponse.json({ ok: false, message: '저장할 대회가 없어요.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const rows = races.map((r) => ({
      name: r.name,
      race_date: r.race_date,
      location: r.location,
      distances: r.distances,
      registration_status: r.registration_status,
      source_name: r.source_name,
      source_url: r.source_url,
      external_id: r.external_id,
    }))

    // external_id 기준 upsert -> 재크롤링해도 중복 안 쌓임
    const { data, error } = await supabase
      .from('races')
      .upsert(rows, { onConflict: 'external_id' })
      .select()

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, saved: data?.length ?? 0 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: 500 })
  }
}
