// 사용법: (운영 빌드 뒤) node scripts/v22-gfx-sheet.cjs → screenshots/v22-gfx/sheet.html
// 실제 컴포넌트(TreeArt·CharacterArt)를 그대로 그려 그래픽 확인 시트를 만듭니다(화면 코드는 바꾸지 않음)
const path = require('path'), fs = require('fs'), Module = require('module')
const NM = 'E:/claude/sgrh-health/node_modules/'
const ts = require(NM + 'typescript')
const ROOT = 'E:/claude/.worktrees/sgrh-health-v21/'
const origResolve = Module._resolveFilename
Module._resolveFilename = function (req, parent, ...rest) {
  if (req.startsWith('@/')) req = path.join(ROOT, req.slice(2))
  if (/^(react|react-dom)(\/|$)/.test(req)) req = NM + req
  if (req.startsWith('@supabase/')) req = NM + req
  return origResolve.call(this, req, parent, ...rest)
}
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (m, file) => {
    const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: 1, target: 7, jsx: 4, esModuleInterop: true } })
    m._compile(out.outputText, file)
  }
}
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'x'
const React = require(NM + 'react')
const { renderToStaticMarkup } = require(NM + 'react-dom/server')
const { TreeArt, CharacterArt } = require(ROOT + 'components/GardenPanel.tsx')
const { ITEMS, TREE_STAGES } = require(ROOT + 'lib/game.ts')
const h = React.createElement
const css = fs.readdirSync(ROOT + '.next/static/css').filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(ROOT + '.next/static/css/' + f, 'utf8')).join('\n')
const hats = [null, 'hat_cap', 'hat_straw'], tops = [null, 'top_singlet', 'top_jacket'], shoes = [null, 'shoes_run', 'shoes_hike']
const combos = []
for (const a of hats) for (const b of tops) for (const c of shoes) combos.push({ hat: a, top: b, shoes: c })
const label = (e) => [e.hat, e.top, e.shoes].map((k) => ITEMS.find((i) => i.key === k)?.name ?? '없음').join(' / ')
const body = h('div', { className: 'mx-auto max-w-[375px] px-5 py-6' },
  h('h1', { className: 'text-[22px] font-extrabold' }, '나무 4단계'),
  h('div', { className: 'mt-3 grid grid-cols-2 gap-3' }, TREE_STAGES.map((s) => h('div', { key: s.stage, className: 'flex flex-col items-center rounded-lg border border-line py-3' },
    h(TreeArt, { stage: s.stage }), h('p', { className: 'mt-1 text-[14px] font-bold' }, `${s.stage}단계 ${s.name}`), h('p', { className: 'text-[12px] text-ink-500' }, `운동한 날 ${s.from}일부터`)))),
  h('h1', { className: 'mt-8 text-[22px] font-extrabold' }, '캐릭터 아이템 조합 27가지'),
  h('p', { className: 'text-[12px] text-ink-500' }, '모자 / 상의 / 운동화 (기본 캐릭터 + 아이템 6종의 모든 조합)'),
  h('div', { className: 'mt-3 grid grid-cols-3 gap-2' }, combos.map((e, i) => h('div', { key: i, 'data-combo': i, className: 'flex flex-col items-center rounded-lg border border-line py-2' },
    h(CharacterArt, { equipped: e }), h('p', { className: 'mt-1 px-1 text-center text-[10px] leading-tight text-ink-600' }, label(e))))),
  h('h1', { className: 'mt-8 text-[22px] font-extrabold' }, '피드용 작은 크기'),
  h('div', { className: 'mt-3 flex gap-4' }, combos.slice(-3).map((e, i) => h(CharacterArt, { key: i, equipped: e, size: 'sm' }))))
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"><style>${css}</style><style>body{font-family:Pretendard,sans-serif}</style><title>그래픽 확인 시트</title></head><body>${renderToStaticMarkup(body)}</body></html>`
fs.mkdirSync(ROOT + 'screenshots/v22-gfx', { recursive: true }); fs.writeFileSync(ROOT + 'screenshots/v22-gfx/sheet.html', html)
console.log('시트 생성:', ROOT + 'screenshots/v22-gfx/sheet.html', combos.length + '개 조합')
