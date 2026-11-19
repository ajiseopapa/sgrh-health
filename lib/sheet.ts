// 엑셀 일괄 등록용 표 읽기 — 외부 라이브러리 없이 브라우저에서 읽습니다.
//  · 엑셀에서 칸을 복사해 붙여넣은 글(탭 구분) · CSV 글 → parseTable
//  · .xlsx 파일 → readXlsx (압축을 풀어 첫 시트만 읽음. 수식·서식은 보지 않고 저장된 값만)
// 열 순서는 사번 / 부서명 / 직위 / 사원명 (11-19 TK, 인사 프로그램 내보내기와 같음)

export interface BulkRow { employeeNumber: string; department: string; position: string; name: string }

/** 표(행×열 글자) → 등록할 줄. 첫 줄이 제목(사번…)이면 건너뜀. 완전히 빈 줄은 뺌 */
export function toBulkRows(table: string[][]): BulkRow[] {
  const rows = table.map((r) => r.map((c) => (c ?? '').trim())).filter((r) => r.some((c) => c))
  if (rows.length && /사번|사원번호/.test(rows[0][0] ?? '')) rows.shift()
  return rows.map((r) => ({ employeeNumber: r[0] ?? '', department: r[1] ?? '', position: r[2] ?? '', name: r[3] ?? '' }))
}

/** 붙여넣은 글: 탭이 있으면 탭 구분(엑셀 복사), 없으면 쉼표 구분(CSV, 따옴표 처리) */
export function parseTable(text: string): string[][] {
  const t = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  if (t.includes('\t')) return t.split('\n').map((l) => l.split('\t'))
  const out: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = '' }
    else cell += ch
  }
  row.push(cell); out.push(row)
  return out
}

// ── .xlsx(zip + XML) 읽기 ──
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** zip 안의 파일 이름 → 내용(글). 중앙 디렉터리를 읽어 필요한 파일만 풉니다 */
async function unzipText(buf: ArrayBuffer, want: (name: string) => boolean): Promise<Map<string, string>> {
  const u8 = new Uint8Array(buf), dv = new DataView(buf)
  let eocd = -1
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('NOT_XLSX')
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const dec = new TextDecoder('utf-8')
  const out = new Map<string, string>()
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('NOT_XLSX')
    const method = dv.getUint16(p + 10, true)
    const csize = dv.getUint32(p + 20, true)
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true)
    const local = dv.getUint32(p + 42, true)
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen))
    p += 46 + nlen + elen + clen
    if (!want(name)) continue
    const lh = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true)
    const raw = u8.subarray(lh, lh + csize)
    const data = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null
    if (!data) throw new Error('NOT_XLSX')
    out.set(name, dec.decode(data))
  }
  return out
}

const colIndex = (ref: string) => {
  let n = 0
  for (const ch of ref.replace(/[^A-Z]/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** .xlsx 파일의 첫 시트를 표(행×열 글자)로. 엑셀이 아니면 Error('NOT_XLSX') */
export async function readXlsx(file: Blob): Promise<string[][]> {
  const files = await unzipText(await file.arrayBuffer(), (n) => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
  const sheetName = [...files.keys()].filter((n) => n.startsWith('xl/worksheets/')).sort((a, b) => a.length - b.length || a.localeCompare(b))[0]
  if (!sheetName) throw new Error('NOT_XLSX')
  const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml')
  // 공유 문자열: <si> 안의 <t> 를 이어 붙임(한자 발음 표기 <rPh> 는 뺌)
  const shared: string[] = []
  const ss = files.get('xl/sharedStrings.xml')
  if (ss) {
    for (const si of Array.from(xml(ss).getElementsByTagName('si'))) {
      let s = ''
      for (const t of Array.from(si.getElementsByTagName('t'))) if (t.parentElement?.tagName !== 'rPh') s += t.textContent ?? ''
      shared.push(s)
    }
  }
  const table: string[][] = []
  for (const row of Array.from(xml(files.get(sheetName)!).getElementsByTagName('row'))) {
    const cells: string[] = []
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const i = colIndex(c.getAttribute('r') ?? '')
      const type = c.getAttribute('t')
      const v = c.getElementsByTagName('v')[0]?.textContent ?? ''
      let text = v
      if (type === 's') text = shared[Number(v)] ?? ''
      else if (type === 'inlineStr') text = Array.from(c.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('')
      else if (v && /^-?\d+(\.\d+)?(E[+-]?\d+)?$/i.test(v)) text = String(Number(v)) // 숫자 칸(사번): 1.34006E5 같은 표기도 숫자로
      if (i >= 0) cells[i] = text
    }
    table.push(Array.from(cells, (c) => c ?? ''))
  }
  return table
}
