// v2.2 게임화 — 화면과 서버가 같이 쓰는 규칙(계산만, DB 접근 없음)
//
// 햇빛 보상 (PM v2.2 지시서 P1)
//  · 운동한 날(하루 첫 기록)마다 10 — 하루에 여러 번 기록해도 1번
//  · 한 주(월~일)에 운동한 날이 3일 이상이면 20 — 주마다 1번
//  · 그 주의 개인 목표를 달성하면 20 — 주마다 1번(목표를 바꿔도 키가 같은 주라 중복 없음)
//    판정 목표 = 그 주가 시작될 때(월 0시) 적용 중이던 목표. 그 주에 처음 정했다면 처음 정한 목표.
//    주중에 낮추거나 높여도 그 주 판정은 그대로 → 낮춰서 받기·높여서 회수·중복 모두 없음. 다음 주부터 새 목표.
//  · 도입일 이전 기록은 세지 않음(소급 없음). 도입일이 낀 주는 도입일부터 센 기록으로 판정.
//  · 받은 햇빛은 저장하지 않고 기록에서 계산 → 기록 수정·삭제 시 자동 재계산.

export const SUN_DAY = 10
export const SUN_WEEK3 = 20
export const SUN_GOAL = 20
export const WEEK3_DAYS = 3

// ── 나무: 도입일 이후 운동한 날 수로 4단계. 쉬어도 줄지 않음(누적) ──
export const TREE_STAGES = [
  { stage: 1, name: '새싹', from: 0 },
  { stage: 2, name: '어린 나무', from: 5 },
  { stage: 3, name: '나무', from: 15 },
  { stage: 4, name: '큰 나무', from: 30 },
] as const
export function treeStage(activeDays: number) {
  let cur: (typeof TREE_STAGES)[number] = TREE_STAGES[0]
  for (const s of TREE_STAGES) if (activeDays >= s.from) cur = s
  const next = TREE_STAGES.find((s) => s.from > activeDays) ?? null
  return { stage: cur.stage, name: cur.name, activeDays, next: next ? { stage: next.stage, name: next.name, at: next.from, remaining: next.from - activeDays } : null }
}

// ── 캐릭터 꾸미기: 아이템 6종(모자·상의·운동화). 모양만 바뀌고 능력 효과 없음 ──
// ── 캐릭터 꾸미기 아이템: 햇빛으로 사서 입음(11-19 TK). 그림은 디자이너 v5(design/items-v5-2026-11-19, scripts/import-wear-v5.py) ──
//  · 칸(slot)마다 1개씩. 키는 `<칸>_<이름>`(game_purchases 키 규칙 ^[a-z]+_[a-z]+$)
//  · 그림: public/game/v22/wear/item-<칸>-<이름>-<m|f>.png (512×768, 캐릭터와 같은 캔버스·같은 자리), 아이콘 icon-<칸>-<이름>.png
//  · 기본 몸: base-<m|f>-<부위>.png 6장. 겹치면 운동복 캐릭터와 픽셀까지 같음
//  · 의상도 레이어(outfit-<칸>-<의상>-<m|f>.png)라, 상의·하의·신발 아이템을 고르면 의상의 같은 부위만 바뀜(v5부터 모든 의상에 모든 아이템)
export type Slot = 'back' | 'shoes' | 'bottom' | 'top' | 'face' | 'hair' | 'hat' | 'hand' | 'effect'
export const SLOTS: Slot[] = ['hat', 'hair', 'face', 'top', 'bottom', 'shoes', 'back', 'hand', 'effect']
export interface Item { key: string; slot: Slot; name: string; price: number; id: string; uniform?: boolean }
const item = (slot: Slot, id: string, name: string, price: number): Item => ({ key: `${slot}_${id}`, slot, id, name, price })
/** 유니폼(11-20 TK): 운동복 말고 다른 옷은 햇빛으로 삼. 옷 칸(상의 칸에 저장)의 통그림 옷 */
const uniform = (id: string, name: string, price: number): Item => ({ ...item('top', id, name, price), uniform: true })
export const ITEMS: Item[] = [
  item('hat', 'hairband', '헤어밴드', 30),
  item('hat', 'baseballcap', '야구모자', 50),
  item('hat', 'beanie', '비니', 50),
  item('hat', 'buckethat', '버킷햇', 50),
  item('hat', 'strawhat', '밀짚모자', 60),
  item('hat', 'catheadphones', '고양이 헤드폰', 80),
  item('hair', 'greenribbon', '초록 리본', 20),
  item('hair', 'creamribbon', '크림 리본', 20),
  item('hair', 'whiteflower', '흰 꽃', 20),
  item('hair', 'pinkflower', '분홍 꽃', 20),
  item('hair', 'hairpins', '머리핀', 20),
  item('hair', 'sproutclip', '새싹 핀', 30),
  item('face', 'mask', '마스크', 20),
  item('face', 'blush', '볼터치', 20),
  item('face', 'bandage', '반창고', 20),
  item('face', 'glasses', '뿔테 안경', 30),
  item('face', 'roundglasses', '둥근 안경', 30),
  item('face', 'sunglasses', '선글라스', 40),
  uniform('nurse', '간호복', 100),
  uniform('doctor', '가운', 100),
  uniform('office', '정장', 100),
  uniform('scrub', '스크럽', 100),
  uniform('hoodie', '후드 집업', 100),
  uniform('chef', '조리복', 100),
  uniform('worker', '작업복', 100),
  item('top', 'tshirt', '라임 반팔', 20),
  item('top', 'vest', '조끼', 60),
  item('top', 'whitezipup', '흰 집업', 70),
  item('top', 'greenhoodie', '초록 후드', 70),
  item('top', 'creamhoodie', '크림 후드', 70),
  item('top', 'blackjacket', '검은 점퍼', 80),
  item('top', 'whitewindbreaker', '흰 바람막이', 80),
  item('bottom', 'grayshorts', '회색 반바지', 50),
  item('bottom', 'blackshorts', '검은 반바지', 50),
  item('bottom', 'shortshorts', '짧은 반바지', 50),
  item('bottom', 'graypants', '회색 긴바지', 50),
  item('bottom', 'stripedpants', '줄무늬 바지', 50),
  item('shoes', 'whitesneakers', '흰 운동화', 40),
  item('shoes', 'darksneakers', '진한 운동화', 50),
  item('shoes', 'limesneakers', '연두 운동화', 50),
  item('shoes', 'blacksneakers', '검은 운동화', 50),
  item('shoes', 'hightops', '하이탑', 60),
  item('back', 'greenbackpack', '초록 배낭', 60),
  item('back', 'wings', '날개', 200),
  item('hand', 'idbadge', '사원증', 20),
  item('hand', 'pen', '펜', 20),
  item('hand', 'towel', '수건', 30),
  item('hand', 'waterbottle', '물병', 30),
  item('hand', 'clipboard', '클립보드', 30),
  item('hand', 'stethoscope', '청진기', 40),
  item('hand', 'drawstringbag', '복주머니 가방', 40),
  item('hand', 'crossbodybag', '크로스백', 50),
  item('hand', 'waistbag', '힙색', 50),
  item('hand', 'smartwatch', '스마트워치', 60),
  item('effect', 'sprout', '새싹 머리', 80),
  item('effect', 'sparkles', '반짝이', 100),
  item('effect', 'laurel', '월계수', 120),
  item('effect', 'crown', '왕관', 150),
]
export const SLOT_LABEL: Record<Slot, string> = {
  hat: '모자', hair: '머리 장식', face: '안경', top: '옷', bottom: '하의', shoes: '신발', back: '가방', hand: '소품', effect: '특별',
}
export type Equipped = Partial<Record<Slot, string | null>>
export const itemIcon = (it: Item) => `/game/v22/wear/icon-${it.slot}-${it.id}.png`
const itemLayer = (it: Item, g: string) => `/game/v22/wear/item-${it.slot}-${it.id}-${g}.png`
const base = (g: string, part: string) => `/game/v22/wear/base-${g}-${part}.png`
// ── 옷은 통그림, 꾸미기는 운동복에서만(11-20 TK) ──
//  · 잘라 덧입히는 방식은 디자이너 그림(생성 도구)이 겹치는 자리가 맞지 않아 가장자리가 깨짐(v5·v6) → 옷은 사람까지 그린 전신 한 장
//  · 옷 = 유니폼 + 상의·하의·신발 아이템. 모두 햇빛으로 사고, 한 번에 한 벌만 입음(서버가 나머지 옷 칸을 비움)
//  · 유니폼을 입으면 꾸미기(모자·머리 장식·안경·가방·소품·특별)는 안 보임. 운동복과 상의·하의·신발 아이템(운동복 계열,
//    머리가 기본 캐릭터와 픽셀까지 같음)에는 꾸미기를 겹침(11-20 TK). 꾸미기를 입으면 서버가 유니폼을 벗김
//  · 옷 전신 그림: public/game/v22/looks/look-<칸>-<이름>-<m|f>.png (512×768). 받은 그림은 LOOK_READY 에 키를 넣어야 쓰임
//    아직 없으면: 유니폼은 예전 의상 그림(characters/char-<m|f>-<이름>.png), 상의·하의·신발은 기본 몸 위에 그 옷만 겹쳐 보여 줌
//  · game_profiles.outfit(예전에 무료로 고른 의상)은 더 이상 그림에 쓰지 않음
export const CLOTHES: Slot[] = ['top', 'bottom', 'shoes']
export const isClothes = (s: Slot) => CLOTHES.includes(s)
export const UNIFORM_KEYS = ITEMS.filter((i) => i.uniform).map((i) => i.key)
// 디자이너 통그림 v8(11-20, design/full-looks-v8-2026-11-20): 머리는 기준 캐릭터와 픽셀 차이 0(조리모만 예외), 발바닥 y=755
export const LOOK_READY = new Set<string>([
  'bottom_blackshorts',
  'bottom_graypants',
  'bottom_grayshorts',
  'bottom_shortshorts',
  'bottom_stripedpants',
  'shoes_blacksneakers',
  'shoes_darksneakers',
  'shoes_hightops',
  'shoes_limesneakers',
  'shoes_whitesneakers',
  'top_blackjacket',
  'top_chef',
  'top_creamhoodie',
  'top_doctor',
  'top_greenhoodie',
  'top_hoodie',
  'top_nurse',
  'top_office',
  'top_scrub',
  'top_vest',
  'top_whitewindbreaker',
  'top_whitezipup',
  'top_worker',
])
const lookSrc = (it: Item, g: string) => `/game/v22/looks/look-${it.slot}-${it.id}-${g}.png`
/** 입은 옷(유니폼·상의·하의·신발 중 하나). 예전 데이터로 여러 개면 상의 → 하의 → 신발 순으로 하나만 */
export function wornClothes(equipped: Equipped | null | undefined): Item | null {
  for (const s of CLOTHES) {
    const it = itemByKey(equipped?.[s] ?? null)
    if (it && it.slot === s) return it
  }
  return null
}
/** 옷 하나의 전신 그림 레이어(꾸미기 없이) */
export function clothesLayers(c: Item, key: string | null | undefined): string[] {
  const g = characterOf(key).key
  if (LOOK_READY.has(c.key)) return [lookSrc(c, g)]
  if (c.uniform) return [`/game/v22/characters/char-${g}-${c.id}.png`]
  return [base(g, 'hair-back'), base(g, 'body'), base(g, 'shoes'), ...(c.slot === 'shoes' ? [itemLayer(c, g)] : []),
    base(g, 'bottom'), ...(c.slot === 'bottom' ? [itemLayer(c, g)] : []), base(g, 'top'), ...(c.slot === 'top' ? [itemLayer(c, g)] : []),
    base(g, 'hair-front')]
}
/**
 * 캐릭터 그림 겹치기(아래에서 위로).
 * 유니폼이면 그 전신 그림 한 장만. 아니면 몸(운동복 또는 상의·하의·신발 아이템 전신 그림) + 꾸미기
 * (가방 → 몸 → 안경 → 머리 장식 → 모자 → 소품 → 특별).
 * outfit 인자는 예전 호출과 맞추려고 남겨 둠(쓰지 않음).
 */
export function characterLayers(key: string | null | undefined, _outfit: string | null | undefined, equipped: Equipped | null | undefined): string[] {
  const g = characterOf(key).key
  const c = wornClothes(equipped)
  // 11-20 TK: 꾸미기(모자·안경·소품 등)는 중단 — 이미 입은 기록이 있어도 그리지 않음. 옷을 입었으면 그 옷 그림, 아니면 운동복
  return c ? clothesLayers(c, g) : [characterSrc(g, DEFAULT_OUTFIT)]
}
/** 지금 파는 옷(11-20 TK): 운동복(기본·무료) + 새 그림이 온 유니폼 4종만. 나머지는 새 그림이 오면 여기에 더함 */
export const SHOP_KEYS = new Set<string>(['top_nurse', 'top_doctor', 'top_office', 'top_scrub'])
/** 아이템 상점(해금·장착) 화면 노출. PM 결정(11-13)으로 보류 — 후속 버전에서 true. 서버 기능·DB·구매 기록은 그대로 둠 */
export const SHOW_ITEM_SHOP = false
/** 캐릭터 옷 화면. 11-20 TK: 운동복 + 유니폼(SHOP_KEYS)만 열고 꾸미기는 중단 */
export const WARDROBE_OPEN = true
/** 부서 정원 화면 노출. 혼자 근무하는 부서가 있어 11-17 TK 결정으로 개인 나무로 바꿈 — 서버 계산·DB 는 그대로 둠 */
export const SHOW_DEPT_GARDEN = false

/** 픽셀 캐릭터 2종(본인이 고름, 성별·인사정보와 연결하지 않음). 고르지 않으면 DEFAULT_CHARACTER */
// 그림: 디자이너 확정본(11-19 TK). 256×384 투명 PNG — 도트 격자가 아닌 큰 그림이라 화면에서 부드럽게 줄여 그림(pixelated 아님)
export const CHARACTERS = [
  { key: 'm', name: '남성형', src: '/game/v22/characters/char-m.png' },
  { key: 'f', name: '여성형', src: '/game/v22/characters/char-f.png' },
] as const
export type CharacterKey = (typeof CHARACTERS)[number]['key']
export const DEFAULT_CHARACTER: CharacterKey = 'm'
export function isCharacterKey(v: unknown): v is CharacterKey {
  return typeof v === 'string' && CHARACTERS.some((c) => c.key === v)
}
// ── 의상: 누구나 자유롭게 고름(11-19 TK, 햇빛 안 씀). 그림은 의상별 전신 그림(scripts/cut-outfit-art.py, 디자이너 의상 시트) ──
//  · 파일: public/game/v22/characters/char-<m|f>-<의상>.png. 같은 의상이라도 남성형·여성형 색이 다른 것이 있음(스크럽: 네이비/분홍)
//  · 고른 의상은 game_profiles.outfit(035). 비어 있으면 기본 의상(운동복)
export const OUTFITS = [
  { key: 'workout', name: '운동복' },
  { key: 'nurse', name: '간호복' },
  { key: 'doctor', name: '가운' },
  { key: 'office', name: '정장' },
  { key: 'hoodie', name: '후드 집업' },
  { key: 'scrub', name: '스크럽' },
  { key: 'glasses', name: '가운과 안경' },
  { key: 'vest', name: '셔츠 차림' },
] as const
export type OutfitKey = (typeof OUTFITS)[number]['key']
export const DEFAULT_OUTFIT: OutfitKey = 'workout'
export function isOutfitKey(v: unknown): v is OutfitKey {
  return typeof v === 'string' && OUTFITS.some((o) => o.key === v)
}
/** 캐릭터(m·f) + 의상 → 그림 주소. 모르는 값이면 기본 캐릭터·기본 의상 */
export function characterSrc(key: string | null | undefined, outfit?: string | null) {
  return `/game/v22/characters/char-${characterOf(key).key}-${isOutfitKey(outfit) ? outfit : DEFAULT_OUTFIT}.png`
}
export function characterOf(key: string | null | undefined) {
  return CHARACTERS.find((c) => c.key === key) ?? CHARACTERS.find((c) => c.key === DEFAULT_CHARACTER)!
}

/** 피드 이름 앞 이모지 — 본인이 고름(정해진 목록만, 서버가 확인). 사람 모양 이모지는 피부색 차이가 없는 것만 */
export const NAME_EMOJIS = [
  '😀', '😄', '😊', '🙂', '😎', '🤓', '🥳', '🤩', '😆', '😇', '🥰', '😤',
  '🏃', '🚶', '🚴', '🏊', '🧘', '🏋️', '⚽', '🏸',
  '🎾', '⛰️', '🌱', '🌳', '🔥', '💪', '⭐', '☀️',
  '🌈', '🍀', '🐢', '🐰', '🐻', '🐯', '🦊', '🐳',
] as const
export function isNameEmoji(v: unknown): v is string {
  return typeof v === 'string' && (NAME_EMOJIS as readonly string[]).includes(v)
}

export const DEFAULT_LOOK = { head: '🙂', top: '👕' } // 기본 캐릭터 1종(아이템 없을 때)
export function itemByKey(key: string | null | undefined): Item | null {
  return ITEMS.find((i) => i.key === key) ?? null
}

// ── 나의 정원: 80×80칸 정원에 장식을 자유롭게 놓습니다(11-18 TK 결정: 칸 고정 → 자유 배치, 이모지 → 도트 그림). 모양만 바뀌고 효과 없음 ──
//  · 햇빛으로 사면 내 것(환불 없음). 놓고, 옮기고, 빼 둘 수 있음. 같은 장식은 1개만.
//  · 키는 game_purchases 검사(^[a-z]+_[a-z]+$)에 맞게 decor_xxx.
//  · 좌표 (x, y) = 장식의 발끝(그림 아래쪽 가운데), 칸 단위 정수. 그림 크기가 바뀌어도 자리가 안 틀어지고, y 가 클수록 앞에 그려집니다.
//  · 그림: public/game/v22/decor/decor-<이름>.png — 디자이너 시트(design/sprite-sheet-2026-11-19)에서 잘라 넣음(scripts/place-sheet-art.py).
//    w·h 는 정원에서 차지하는 칸 수(1칸 = 정원 4px). 그림 파일은 같은 비율의 큰 그림(1칸 = 8px)이라 부드럽게 줄여 그립니다.
export const GARDEN_SIZE = 80
export const GARDEN_TREE = { x: 40, y: 54 } // 나무 밑동 자리(고정)
/** 정원에서 나무가 차지하는 칸(정사각) — 단계가 오를수록 커집니다(새싹 → 큰 나무) */
export const TREE_GARDEN = [9, 19, 30, 40] as const // 새싹은 캐릭터 무릎 높이, 어린 나무는 캐릭터 키쯤(캐릭터 21칸)
/** 정원에 서 있는 정원 주인 캐릭터(11-19 TK): 나무 오른쪽 앞, 고정 자리. w·h 는 칸(그림 비율 2:3) */
export const GARDEN_CHAR = { x: 59, y: 66, w: 14, h: 21 }
export interface Decor { key: string; name: string; price: number; w: number; h: number; src: string }
const decor = (id: string, name: string, price: number, w = 16, h = 16): Decor =>
  ({ key: `decor_${id}`, name, price, w, h, src: `/game/v22/decor/decor-${id}.png` })
export const DECOR: Decor[] = [
  decor('tulip', '튤립', 30, 14, 15),
  decor('wild', '들꽃', 30, 16, 16),
  decor('sunflower', '해바라기', 40, 14, 18),
  decor('pot', '화분', 50, 16, 17),
  decor('bench', '벤치', 60, 24, 15),
  decor('butterfly', '나비', 70, 16, 11),
  decor('lantern', '정원 등', 80, 12, 22),
  decor('fountain', '분수', 120, 26, 22),
]
export function decorByKey(key: string | null | undefined): Decor | null {
  return DECOR.find((d) => d.key === key) ?? null
}
export interface Placed { key: string; x: number; y: number }
/** 옛 칸 방식(0~7, 3×3 에서 가운데를 뺀 순서)의 자리 → 좌표. 새 장식의 기본 자리로도 씁니다 */
export const GARDEN_SPOTS: { x: number; y: number }[] = [
  { x: 14, y: 26 }, { x: 40, y: 26 }, { x: 66, y: 26 }, { x: 14, y: 52 },
  { x: 66, y: 52 }, { x: 14, y: 78 }, { x: 40, y: 78 }, { x: 66, y: 78 },
]
/** 그림이 정원 밖으로 나가지 않게 발끝 좌표를 맞춤 */
export function clampSpot(d: Decor, x: number, y: number) {
  const half = Math.ceil(d.w / 2)
  return {
    x: Math.min(Math.max(Math.round(x), half), GARDEN_SIZE - half),
    y: Math.min(Math.max(Math.round(y), d.h), GARDEN_SIZE),
  }
}

// ── 보상 계산 ──
export interface Reward { key: string; kind: 'day' | 'week3' | 'goal'; date: string; points: number; label: string }

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function weekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  return addDays(date, -((dow + 6) % 7))
}

export interface DayInput { date: string; sessions: number; seconds: number }
export interface GoalInput { kind: 'sessions' | 'minutes'; target: number }
export interface GoalChange { kind: 'sessions' | 'minutes'; target: number; changed_at: string }

/** 한국 시간 그 날 0시의 시각(ms) */
export function kstMidnight(date: string): number {
  return Date.parse(`${date}T00:00:00+09:00`)
}
/** 게임 보상 판정용 그 주 목표: 월 0시 이전 마지막 변경, 없으면 그 주 안의 첫 변경 */
export function gameGoalForWeek(history: GoalChange[], week: string): GoalInput | null {
  const start = kstMidnight(week)
  const end = start + 7 * 86400000
  let before: GoalChange | null = null
  let firstIn: GoalChange | null = null
  for (const h of history) {
    const t = Date.parse(h.changed_at)
    if (t < start) { if (!before || t >= Date.parse(before.changed_at)) before = h }
    else if (t < end) { if (!firstIn || t < Date.parse(firstIn.changed_at)) firstIn = h }
  }
  const g = before ?? firstIn
  return g ? { kind: g.kind, target: g.target } : null
}

/**
 * 받은 햇빛 목록. days = 한 직원의 날짜별 묶음(하루 300분 상한 적용된 인정 시간).
 * goalHistory = 목표 변경 이력(게임 판정은 그 주 시작 목표 기준, gameGoalForWeek).
 */
export function computeRewards(
  days: DayInput[],
  goalHistory: GoalChange[],
  launchDate: string,
  today: string
): Reward[] {
  const counted = days.filter((d) => d.date >= launchDate && d.date <= today)
  const out: Reward[] = []
  for (const d of counted) out.push({ key: `day:${d.date}`, kind: 'day', date: d.date, points: SUN_DAY, label: '운동한 날' })

  const byWeek = new Map<string, DayInput[]>()
  for (const d of counted) {
    const w = weekStart(d.date)
    byWeek.set(w, [...(byWeek.get(w) ?? []), d])
  }
  for (const [w, list] of byWeek) {
    const lastDate = list.map((d) => d.date).sort().at(-1)!
    if (list.length >= WEEK3_DAYS) {
      // 세 번째 운동한 날에 받은 것으로 표시
      const third = list.map((d) => d.date).sort()[WEEK3_DAYS - 1]
      out.push({ key: `week3:${w}`, kind: 'week3', date: third, points: SUN_WEEK3, label: '주 3일 운동' })
    }
    const g = gameGoalForWeek(goalHistory, w)
    if (g) {
      const value = g.kind === 'sessions'
        ? list.reduce((s, d) => s + d.sessions, 0)
        : Math.floor(list.reduce((s, d) => s + d.seconds, 0) / 60)
      if (value >= g.target) out.push({ key: `goal:${w}`, kind: 'goal', date: lastDate, points: SUN_GOAL, label: '주간 목표 달성' })
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.key.localeCompare(b.key) : a.date < b.date ? -1 : 1))
}

// ── 부서 공동 정원 ──
// 주간 공동 목표 = 그 달 인사팀 확인 인원 × 1일 ("부서 인원 수만큼 운동한 날이 모이면")
// 인원 정보가 없거나, 참여 인원이 인사팀 인원보다 많으면(자료 불일치) 목표를 정하지 않습니다.
export const GARDEN_DAYS_PER_PERSON = 1
export const GARDEN_DECOR = [
  { emoji: '🌷', name: '튤립' },
  { emoji: '🌳', name: '나무' },
  { emoji: '🪑', name: '벤치' },
  { emoji: '🌻', name: '해바라기' },
  { emoji: '⛲', name: '분수' },
  { emoji: '🌼', name: '들꽃' },
  { emoji: '🍎', name: '사과나무' },
  { emoji: '🏮', name: '정원 등' },
] as const
export function decorFor(index: number) {
  return GARDEN_DECOR[index % GARDEN_DECOR.length]
}
