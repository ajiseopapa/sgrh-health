# 디자이너 스프라이트 시트(design/sprite-sheet-2026-11-19)에서 잘라 낸 그림을 앱 규격으로 맞춰 public/game/v22 에 넣습니다.
#   python scripts/place-sheet-art.py <잘라 낸 raw-*.png 가 있는 폴더>
# 시트 그림은 도트 격자가 아닌 큰 그림이라, 앱은 부드럽게 줄여 그립니다(pixelated 아님).
#  · 장식: lib/game.ts DECOR 의 w·h(칸, 1칸 = 정원 4px)와 같은 비율의 캔버스(1칸 = 8px)에 아래 가운데로 놓음
#  · 나무: 정사각 320px 에 꽉 차게(아래 가운데). 정원에서의 크기는 lib/game.ts TREE_GARDEN 이 단계별로 정함
#  · 배지: 정사각 256px. 같은 계열 안에서 단계가 오를수록 조금씩 커지게(크기 차이를 절반만 반영)
#  · 캐릭터: 256×384, 두 장 같은 배율·같은 발 위치
import sys, math
from pathlib import Path
from PIL import Image
RAW = Path(sys.argv[1]); PUB = Path('public/game/v22')
K = 0.64 / 4  # 시트 px → 정원 칸
def fit(im, W, H, margin=0, anchor='bottom'):
    s = min((W - 2 * margin) / im.width, (H - 2 * margin) / im.height)
    r = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    y = H - margin - r.height if anchor == 'bottom' else (H - r.height) // 2
    c.alpha_composite(r, ((W - r.width) // 2, y)); return c
cells = {}
for n in ['tulip', 'wild', 'sunflower', 'pot', 'bench', 'butterfly', 'lantern', 'fountain', 'gift-flower']:
    im = Image.open(RAW / f'raw-decor-{n}.png')
    w, h = max(8, round(im.width * K)), max(8, round(im.height * K))
    w += w % 2  # 가운데 맞춤이 반 칸 어긋나지 않게 짝수
    cells[n] = (w, h)
    fit(im, w * 8, h * 8).save(PUB / 'decor' / f'decor-{n}.png')
for i in range(1, 5):
    fit(Image.open(RAW / f'raw-stage-{i}.png'), 320, 320).save(PUB / 'tree' / f'stage-{i}.png')
B = ['record-01', 'record-10', 'record-30', 'record-100', 'streak-03', 'streak-07', 'streak-14', 'streak-30', 'goal-01', 'goal-04', 'goal-12']
ims = {n: Image.open(RAW / f'raw-{n}.png') for n in B}
big = max(max(i.size) for i in ims.values())
for n, im in ims.items():
    box = round(244 * math.sqrt(max(im.size) / big))
    c = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); c.alpha_composite(fit(im, box, box, anchor='center'), ((256 - box) // 2, (256 - box) // 2))
    c.save(PUB / 'badges' / f'{n}.png')
cm, cf = Image.open(RAW / 'raw-char-m.png'), Image.open(RAW / 'raw-char-f.png')
s = 372 / max(cm.height, cf.height)
for n, im in (('char-m', cm), ('char-f', cf)):
    r = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    c = Image.new('RGBA', (256, 384), (0, 0, 0, 0)); c.alpha_composite(r, ((256 - r.width) // 2, 378 - r.height)); c.save(PUB / 'characters' / f'{n}.png')
(PUB / 'garden').mkdir(exist_ok=True)
Image.open(RAW / 'raw-garden-bg.png').resize((640, 640), Image.LANCZOS).save(PUB / 'garden' / 'garden-bg.png')
print('decor cells', cells)
print('tree px(sheet)', [Image.open(RAW / f'raw-stage-{i}.png').size for i in range(1, 5)])
