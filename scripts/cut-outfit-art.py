# 의상 시트(design/outfit-sheet-2026-11-19/outfit-sheet-original.png)에서 의상별 전신 캐릭터 16장을 잘라
# public/game/v22/characters/char-<m|f>-<의상>.png (256×384, 투명) 로 넣습니다.
#   python scripts/cut-outfit-art.py
# 위 줄(기본 4벌)과 아래 줄(변형 4벌)은 그려진 크기가 달라, 줄마다 남성형 키를 같은 높이로 맞춥니다(여성형은 같은 배율).
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage as ndi
SRC = 'design/outfit-sheet-2026-11-19/outfit-sheet-original.png'
OUT = Path('public/game/v22/characters')
KEYS = ['workout', 'nurse', 'doctor', 'office', 'hoodie', 'scrub', 'glasses', 'vest']  # lib/game.ts OUTFITS 와 같은 순서
im = Image.open(SRC).convert('RGB'); a = np.asarray(im)
light = a.min(2) >= 215
lab, n = ndi.label(light); sizes = ndi.sum(light, lab, range(1, n + 1))
bg = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 6000])   # 바깥 바탕·옅은 색 판만 배경(그림 안의 흰색은 남김)
fg = ndi.binary_opening(~bg, structure=np.ones((3, 3)))
boxes = []
for y0, y1 in ((135, 480), (595, 860)):
    m = np.zeros_like(fg); m[y0:y1] = fg[y0:y1]
    l2, _ = ndi.label(ndi.binary_dilation(m, structure=np.ones((7, 7))))
    row = []
    for sl in ndi.find_objects(l2):
        if sl[0].stop - sl[0].start >= 150 and sl[1].stop - sl[1].start >= 60:
            row.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
    row.sort(); assert len(row) == 8, len(row); boxes.append(row)
def cut(box):
    x0, y0, x1, y1 = box
    m = fg[y0:y1, x0:x1]
    l, k = ndi.label(m); m = l == 1 + int(np.argmax(ndi.sum(m, l, range(1, k + 1))))   # 가장 큰 덩어리 = 캐릭터
    m = ndi.binary_fill_holes(m)
    ys, xs = np.where(m)
    c = Image.fromarray(a[y0:y1, x0:x1]).convert('RGBA')
    c.putalpha(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.6)))
    return c.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
for r, row in enumerate(boxes):
    pairs = [(cut(row[i * 2]), cut(row[i * 2 + 1])) for i in range(4)]
    s = 372 / max(p[0].height for p in pairs)
    for i, (m_, f_) in enumerate(pairs):
        for g, sp in (('m', m_), ('f', f_)):
            rs = sp.resize((round(sp.width * s), round(sp.height * s)), Image.LANCZOS)
            c = Image.new('RGBA', (256, 384), (0, 0, 0, 0)); c.alpha_composite(rs, ((256 - rs.width) // 2, 378 - rs.height))
            c.save(OUT / f'char-{g}-{KEYS[r * 4 + i]}.png')
# 확인용 시트
sheet = Image.new('RGBA', (8 * 136, 2 * 200), '#F6F4EE')
for i, k in enumerate(KEYS):
    for j, g in enumerate('mf'):
        t = Image.open(OUT / f'char-{g}-{k}.png').resize((128, 192), Image.LANCZOS); sheet.alpha_composite(t, (i * 136 + 4, j * 200 + 4))
Path('test-results').mkdir(exist_ok=True); sheet.convert('RGB').save('test-results/outfit-sheet.png'); print('ok', len(list(OUT.glob('char-*-*.png'))))

# ── 사원증 보정(11-19 TK): 원본 시트에서 여성형 후드 집업·셔츠 차림에만 사원증이 없음 → 같은 의상 남성형의 사원증을 옮겨 붙임 ──
def badge_patch(src, box):
    """box 안의 사원증 몸통(밝은 덩어리)과 집게(파란 조각)를 떼고, 검은 테두리 2px 를 새로 둘러 줌"""
    im = Image.open(OUT / src).convert('RGBA'); x0, y0, x1, y1 = box
    a2 = np.asarray(im)[y0:y1, x0:x1, :3].astype(int)
    r, g, b = a2[:, :, 0], a2[:, :, 1], a2[:, :, 2]
    light = a2.min(2) > 150
    l, k = ndi.label(light)
    body = ndi.binary_fill_holes(l == 1 + int(np.argmax(ndi.sum(light, l, range(1, k + 1)))))
    clip = (b > r + 25) & (b > 110) & ndi.binary_dilation(body, structure=np.ones((3, 3)), iterations=7)   # 몸통 바로 위 파란 집게
    core = ndi.binary_fill_holes(body | clip)
    ring = ndi.binary_dilation(core, structure=np.ones((3, 3)), iterations=2) & ~core
    out = np.zeros((y1 - y0, x1 - x0, 4), 'uint8')
    out[core] = np.concatenate([a2[core], np.full((core.sum(), 1), 255)], 1)
    out[ring] = (22, 26, 30, 255)
    return Image.fromarray(out, 'RGBA')
for src, dst, box, dx, dy in (('char-m-hoodie.png', 'char-f-hoodie.png', (141, 220, 179, 269), -11, -3),
                              ('char-m-vest.png', 'char-f-vest.png', (141, 217, 177, 264), -12, -2)):
    p = badge_patch(src, box)
    t = Image.open(OUT / dst).convert('RGBA'); t.alpha_composite(p, (box[0] + dx, box[1] + dy)); t.save(OUT / dst)
    print('badge', dst, p.getbbox())
