# 아이템 아이콘(256×256)을 아이템 레이어 그림에서 만듭니다 — public/game/v22/wear/icon-<칸>-<이름>.png
#   python scripts/make-wear-icons.py
# 11-19: 받은 아이콘 묶음(design/items-v4-2026-11-19/icons-received) 중 왕관·물병이 잘리고, 선글라스 자리에 마스크가 들어가고,
# 상의 3종에 옆 그림이 섞여 있어 — 그 6개만 앱에 입혀지는 그림(남성형 레이어)을 잘라 아이콘으로 씁니다. 나머지 10개는 받은 아이콘 그대로.
REDO = {('effect', 'crown'), ('face', 'sunglasses'), ('hand', 'waterbottle'), ('top', 'creamhoodie'), ('top', 'greenhoodie'), ('top', 'whitezipup')}
from pathlib import Path
from PIL import Image
W = Path('public/game/v22/wear')
for f in sorted(W.glob('item-*-m.png')):
    slot, name = f.stem.split('-')[1:3]
    if (slot, name) not in REDO: continue
    im = Image.open(f).convert('RGBA')
    bb = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    crop = im.crop(bb)
    s = min(220 / crop.width, 220 / crop.height)
    r = crop.resize((max(1, round(crop.width * s)), max(1, round(crop.height * s))), Image.LANCZOS)
    c = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); c.alpha_composite(r, ((256 - r.width) // 2, (256 - r.height) // 2))
    c.save(W / f'icon-{slot}-{name}.png')
print('ok', len(list(W.glob('icon-*.png'))))
