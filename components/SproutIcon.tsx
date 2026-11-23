// 움트다 앱 아이콘 — 작은 새싹이 돋아나는 픽셀 아트(사물이라 직접 그림)
// 같은 격자로 public/icon-*.png 를 만듭니다(scripts/make-icons.py). 격자를 바꾸면 그 스크립트도 같이 바꾸세요.
export const SPROUT_GRID = [
  '............',
  '........##..',
  '.##....#cc#.',
  '#bb#..#cccc#',
  '#abb#.#ccc#.',
  '.#aab#scc#..',
  '..##.ss##...',
  '.....ss.....',
  '...######...',
  '.##dddddd##.',
  '#dddddddddd#',
  '############',
]

export const SPROUT_COLORS: Record<string, string> = {
  '#': '#202D29', // 테두리(기본 글자색)
  a: '#A9C82E',   // 왼쪽 잎 그늘
  b: '#C6E44A',   // 왼쪽 잎
  c: '#D8F36A',   // 오른쪽 잎(포인트 연두)
  s: '#3C4743',   // 줄기
  d: '#7B8780',   // 흙
}

export default function SproutIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  const n = SPROUT_GRID.length
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" aria-hidden="true" className={className}>
      {SPROUT_GRID.flatMap((row, y) =>
        [...row].map((ch, x) => (SPROUT_COLORS[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={SPROUT_COLORS[ch]} /> : null)),
      )}
    </svg>
  )
}
