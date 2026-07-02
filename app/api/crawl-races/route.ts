import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const LOCATION_KEYWORD = '부산'
const SOURCE_NAME = '마라톤모아'
const SOURCE_LIST_URL = 'https://marathon.me.kr/events'

// 장소 문자열 뒤에 거리 정보가 공백 없이 이어붙어 있어서, 아래 패턴으로 경계를 찾습니다.
const DISTANCE_TOKEN = /(풀코스|하프|\d+(?:\.\d+)?\s?km|\d+\s?K(?!m)|가족런|커플런|마니아|워킹|릴레이|걷기|구간마라톤)/g

interface ParsedRace {
  external_id: string
  name: string
  race_date: string // YYYY-MM-DD
  location: string
  distances: string
  registration_status: string
  source_url: string
}

function parseCard(cardText: string, href: string): ParsedRace | null {
  const idMatch = href.match(/\/events\/([a-f0-9-]+)/)
  if (!idMatch) return null
  const external_id = idMatch[1]

  const statusMatch = cardText.match(/(접수중|접수마감|접수전)/)
  const registration_status = statusMatch ? statusMatch[1] : '알수없음'

  const dateMatch = cardText.match(/일시(\d{4})\.(\d{2})\.(\d{2})\./)
  if (!dateMatch) return null
  const race_date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`

  const afterLocation = cardText.split('장소')[1]
  if (!afterLocation) return null

  // 장소 텍스트 안에서 첫 거리 토큰이 나오는 지점을 경계로 위치/거리 분리
  const distMatches = [...afterLocation.matchAll(DISTANCE_TOKEN)]
  let location = afterLocation.trim()
  let distances = ''
  if (distMatches.length > 0) {
    const firstIdx = distMatches[0].index ?? afterLocation.length
    location = afterLocation.slice(0, firstIdx).trim()
    distances = distMatches.map((m) => m[0].trim()).join(',')
  }

  const nameMatch = cardText.match(/(접수중|접수마감|접수전)([^]*?)일시/)
  const name = nameMatch ? nameMatch[2].trim() : ''

  if (!name || !location) return null

  return {
    external_id,
    name,
    race_date,
    location,
    distances,
    registration_status,
    source_url: href.startsWith('http') ? href : `https://marathon.me.kr${href}`,
  }
}

async function crawl(): Promise<ParsedRace[]> {
  const res = await fetch(SOURCE_LIST_URL, { cache: 'no-store' })
  const html = await res.text()
  const $ = cheerio.load(html)

  const results: ParsedRace[] = []
  $('a[href^="/events/"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const cardText = $(el).text().replace(/\s+/g, ' ').trim()
    if (!cardText.includes(LOCATION_KEYWORD)) return
    const parsed = parseCard(cardText, href)
    if (parsed) results.push(parsed)
  })

  // 중복 제거 (external_id 기준)
  const seen = new Set<string>()
  return results.filter((r) => {
    if (seen.has(r.external_id)) return false
    seen.add(r.external_id)
    return true
  })
}

// GET: 미리보기만 (DB 저장 안 함)
export async function GET() {
  try {
    const races = await crawl()
    return NextResponse.json({ ok: true, count: races.length, races })
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
      source_name: SOURCE_NAME,
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
