# 스타일 검수 시트 — 앱 아이콘과 캐릭터·배지 시안을 나란히 (컬러 / 잠금 상태 흑백)
# 사용법: python scripts/make-art-sheet.py  → screenshots/v22-final/art-sheet.png
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path('public/game/v22')
FONT = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 18)
SMALL = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 14)
BG = (246, 244, 238)
INK = (32, 45, 41)

BADGES = [
    ('record-01', '첫 기록'), ('record-10', '열 번째'), ('record-30', '서른 번'), ('record-100', '백 번'),
    ('streak-03', '3일 연속'), ('streak-07', '일주일 연속'), ('streak-14', '2주 연속'), ('streak-30', '한 달 연속'),
    ('goal-01', '목표 달성'), ('goal-04', '목표 4주'), ('goal-12', '목표 12주'),
]


def locked(im):
    g = ImageOps.grayscale(im.convert('RGB')).convert('RGBA')
    g.putalpha(im.getchannel('A').point(lambda a: int(a * 0.45)))
    return g


def big(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


W = 1200
sheet = Image.new('RGB', (W, 1180), BG)
d = ImageDraw.Draw(sheet)
d.text((40, 24), '움트다 v2.2 픽셀 아트 스타일 검수 시트 (시안)', font=FONT, fill=INK)
d.text((40, 52), '기준: 앱 아이콘 — 1칸 차콜 외곽선 · 2~3단 음영 · 정면 · 아이보리/차콜/초록/라임 + 소량 강조(황금·피부)', font=SMALL, fill=INK)

# 1) 기준 아이콘 + 캐릭터 (×2 확대)
y = 100
d.text((40, y), '① 기준 앱 아이콘 / 캐릭터 2종 (2배 확대)', font=FONT, fill=INK)
icon = Image.open('public/icon-512.png').convert('RGBA').resize((192, 192), Image.NEAREST)
sheet.paste(icon, (40, y + 36))
d.text((40, y + 236), '앱 아이콘', font=SMALL, fill=INK)
for i, (f, name) in enumerate([('char-m', '남성형(기본)'), ('char-f', '여성형')]):
    im = big(Image.open(ROOT / 'characters' / f'{f}.png'), 2)
    x = 300 + i * 200
    sheet.paste(im, (x, y + 36), im)
    d.text((x, y + 236), name, font=SMALL, fill=INK)

# 2) 배지 — 실제 크기(64) 컬러 / 잠금(흑백·반투명)
y = 400
d.text((40, y), '② 배지 11종 — 실제 크기 64px: 위 획득(컬러) / 아래 미획득(흑백·반투명)', font=FONT, fill=INK)
for i, (f, name) in enumerate(BADGES):
    im = Image.open(ROOT / 'badges' / f'{f}.png').convert('RGBA')
    x = 40 + i * 104
    sheet.paste(im, (x, y + 40), im)
    lk = locked(im)
    sheet.paste(lk, (x, y + 140), lk)
    d.text((x, y + 212), name, font=SMALL, fill=INK)
    d.text((x, y + 232), f, font=SMALL, fill=(94, 106, 100))

# 3) 배지 2배 확대 (외곽선·음영 확인)
y = 700
d.text((40, y), '③ 배지 2배 확대 (128px) — 외곽선·픽셀 단위 확인', font=FONT, fill=INK)
for i, (f, name) in enumerate(BADGES):
    im = big(Image.open(ROOT / 'badges' / f'{f}.png').convert('RGBA'), 2)
    x = 40 + (i % 6) * 190
    yy = y + 36 + (i // 6) * 200
    sheet.paste(im, (x, yy), im)
    d.text((x, yy + 134), name, font=SMALL, fill=INK)

out = Path('screenshots/v22-final/art-sheet.png')
sheet.save(out)
print(out)
