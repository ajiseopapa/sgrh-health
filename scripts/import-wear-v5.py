# 디자이너 v5 묶음(아이템 47종 + 의상 8벌 레이어 + 추가 소품)을 앱 폴더로 옮기고 lib/game.ts 의 ITEMS 목록을 만듭니다.
#   python scripts/import-wear-v5.py <압축을 푼 umtuda-all-v5 폴더>
# 원본 기록: design/items-v5-2026-11-19 (README·catalog·편집 원본 .ora·받은 아이콘)
#  · base/ 12장 → public/game/v22/wear/base-*.png (겹치면 운동복 캐릭터와 픽셀 차이 0)
#  · item/ 94장 + extra/ 8장(청진기·사원증·클립보드·펜. 마스크는 item 과 같은 그림이라 뺌) → wear/item-<칸>-<이름>-<m|f>.png
#  · outfit-layer/ 50장 → wear/outfit-<칸>-<의상>-<m|f>.png (의상의 상의·하의·신발, 가운과 안경의 안경)
#  · char/ 16장 → characters/char-<m|f>-<의상>.png (512×768, 의상 레이어를 겹친 것과 같음. 아이템이 없을 때 이 한 장을 씀)
#  · 아이콘: 받은 아이콘을 여백 없이 잘라 256×256 가운데에 크게(작게 그려진 것이 많아서). 배낭은 v4 때 받은 아이콘이 알아보기 쉬워 그것을 씀
import sys, csv, shutil
from pathlib import Path
from PIL import Image
SRC = Path(sys.argv[1]); W = Path('public/game/v22/wear'); C = Path('public/game/v22/characters')
for f in (SRC / 'base').glob('*.png'): shutil.copy(f, W / f.name)
for f in (SRC / 'item').glob('*.png'): shutil.copy(f, W / f.name)
for f in (SRC / 'extra').glob('*.png'):
    if '-mask-' not in f.name: shutil.copy(f, W / f.name)
for f in (SRC / 'outfit-layer').glob('*.png'): shutil.copy(f, W / f.name.replace('item-', 'outfit-', 1))
for f in (SRC / 'char').glob('*.png'): shutil.copy(f, C / f.name)
def icon(src, dst):
    im = Image.open(src).convert('RGBA'); bb = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    cr = im.crop(bb); s = min(200 / cr.width, 200 / cr.height)
    r = cr.resize((max(1, round(cr.width * s)), max(1, round(cr.height * s))), Image.LANCZOS)
    c = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); c.alpha_composite(r, ((256 - r.width) // 2, (256 - r.height) // 2)); c.save(dst)
rows = list(csv.DictReader(open(SRC / 'catalog.csv', encoding='utf-8-sig')))
for r in rows:
    if r['sheet'] == 'item': icon(SRC / 'icon' / f"icon-{r['slot']}-{r['name']}.png", W / f"icon-{r['slot']}-{r['name']}.png")
    if r['sheet'] == 'outfit-extra' and r['name'] != 'mask': icon(SRC / 'icon' / f"icon-extra-{r['name']}.png", W / f"icon-{r['slot']}-{r['name']}.png")
old = Path('design/items-v4-2026-11-19/icons-received/icon-back-greenbackpack.png')
if old.exists(): icon(old, W / 'icon-back-greenbackpack.png')
for r in rows:
    if r['sheet'] != 'outfit': print(r['sheet'], r['slot'], r['name'], r['korean'], sep='\t')
