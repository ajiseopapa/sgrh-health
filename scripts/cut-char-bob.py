# 단발녀 캐릭터(11-27 TK) — 받은 1024×1536 그림을 앱 캐릭터 규격으로.
#  · 원본: design/char-bob-2026-11-27/original.png (검은 번짐 배경이 반투명으로 깔려 있음)
#  · 번짐 제거: 알파 200 미만은 지우고 나머지는 불투명으로
#  · 기존 운동복 캐릭터와 같은 자리: 512×768 캔버스, 발바닥 y=755, 가운데 x≈252, 키 742px
#  · 결과: public/game/v22/characters/char-b-workout.png(512×768), char-b.png(256×384)
#  실행: python scripts/cut-char-bob.py
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
src = Image.open(ROOT / 'design/char-bob-2026-11-27/original.png').convert('RGBA')
a = src.getchannel('A').point(lambda v: 255 if v >= 200 else 0)
src.putalpha(a)
box = a.getbbox()
fig = src.crop(box)
H = 742
scale = H / fig.height
fig = fig.resize((round(fig.width * scale), H), Image.LANCZOS)
canvas = Image.new('RGBA', (512, 768), (0, 0, 0, 0))
x = 252 - fig.width // 2
canvas.alpha_composite(fig, (x, 756 - H))
out = ROOT / 'public/game/v22/characters'
canvas.save(out / 'char-b-workout.png')
canvas.resize((256, 384), Image.LANCZOS).save(out / 'char-b.png')
print('box', box, '->', fig.size, 'at x', x)
