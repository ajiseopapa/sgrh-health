# ⚠️ 11-19 디자이너 v5 묶음(scripts/import-wear-v5.py)으로 대체됨 — 의상 그림은 v5 char/ 를 씀. 이 스크립트를 다시 돌리면 v5 그림을 덮어씀.
# 의상 시트(design/outfit-sheet-2026-11-19/outfit-sheet-v2.webp, 사원증 보완본 11-19)에서 의상별 전신 캐릭터 16장을 잘라
# public/game/v22/characters/char-<m|f>-<의상>.png (256×384, 투명) 로 넣습니다.
#   python scripts/cut-outfit-art.py
# 시트 구성: 윗줄 = 남성형 8벌, 아랫줄 = 여성형 8벌. 왼쪽부터 lib/game.ts OUTFITS 순서.
# 남성형 키를 기준 높이에 맞추고 여성형도 같은 배율로 줄여, 16장의 머리 크기와 발 위치가 같게 합니다.
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage as ndi
SRC = 'design/outfit-sheet-2026-11-19/outfit-sheet-v2.webp'
OUT = Path('public/game/v22/characters')
KEYS = ['workout', 'nurse', 'doctor', 'office', 'hoodie', 'scrub', 'glasses', 'vest']
def load(src):
    im = Image.open(src).convert('RGB'); a = np.asarray(im)
    light = a.min(2) >= 215
    lab, n = ndi.label(light); sizes = ndi.sum(light, lab, range(1, n + 1))
    bg = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 6000])   # 바깥 바탕만 배경(그림 안의 흰 가운·신발은 남김)
    return a, ndi.binary_opening(~bg, structure=np.ones((3, 3)))
a, fg = load(SRC)
H = a.shape[0]
rows = []
for y0, y1 in ((0, H // 2), (H // 2, H)):
    m = np.zeros_like(fg); m[y0:y1] = fg[y0:y1]
    l2, _ = ndi.label(ndi.binary_dilation(m, structure=np.ones((5, 5))))
    row = [(sl[1].start, sl[0].start, sl[1].stop, sl[0].stop) for sl in ndi.find_objects(l2)
           if sl[0].stop - sl[0].start >= 150 and sl[1].stop - sl[1].start >= 60]
    row.sort(); assert len(row) == 8, len(row); rows.append(row)

def cut(box, a=a, fg=fg):
    x0, y0, x1, y1 = box
    m = fg[y0:y1, x0:x1]
    l, k = ndi.label(m); m = l == 1 + int(np.argmax(ndi.sum(m, l, range(1, k + 1))))   # 가장 큰 덩어리 = 캐릭터
    m = ndi.binary_fill_holes(m)
    ys, xs = np.where(m)
    c = Image.fromarray(a[y0:y1, x0:x1]).convert('RGBA')
    c.putalpha(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.6)))
    return c.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

sprites = {g: [cut(b) for b in rows[r]] for r, g in enumerate('mf')}
# 기본 의상(운동복)은 사원증 없이(11-19 TK). 보완본 시트의 여성형 운동복에는 사원증이 달려 있어,
# 사원증이 없는 첫 시안(outfit-sheet-original.png)의 여성형 운동복을 같은 키로 맞춰 대신 씁니다.
a1, fg1 = load('design/outfit-sheet-2026-11-19/outfit-sheet-original.png')
old = cut((221, 160, 378, 459), a1, fg1)
k = sprites['f'][0].height / old.height
sprites['f'][0] = old.resize((round(old.width * k), round(old.height * k)), Image.LANCZOS)
s = 372 / max(sp.height for sp in sprites['m'])
for g in 'mf':
    for k, sp in zip(KEYS, sprites[g]):
        rs = sp.resize((round(sp.width * s), round(sp.height * s)), Image.LANCZOS)
        c = Image.new('RGBA', (256, 384), (0, 0, 0, 0))
        # 여성형은 묶은 머리가 오른쪽으로 나와 있어 몸통(아래 절반) 기준으로 가운데를 맞춤
        al = np.asarray(rs)[rs.height // 2:, :, 3] > 128
        cols = np.where(al.any(0))[0]; cx = (cols.min() + cols.max() + 1) // 2
        c.alpha_composite(rs, (128 - cx, 378 - rs.height)); c.save(OUT / f'char-{g}-{k}.png')
    print(g, [sp.size for sp in sprites[g]])
# 확인용 시트
sheet = Image.new('RGBA', (8 * 136, 2 * 200), '#F6F4EE')
for i, k in enumerate(KEYS):
    for j, g in enumerate('mf'):
        t = Image.open(OUT / f'char-{g}-{k}.png').resize((128, 192), Image.LANCZOS); sheet.alpha_composite(t, (i * 136 + 4, j * 200 + 4))
Path('test-results').mkdir(exist_ok=True); sheet.convert('RGB').save('test-results/outfit-sheet.png'); print('ok', len(list(OUT.glob('char-*-*.png'))))
