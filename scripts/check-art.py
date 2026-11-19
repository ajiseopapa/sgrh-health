# 배지·캐릭터 이미지 점검: 파일 있음 · 크기 · 투명 배경 · 배지 ID 매핑 (lib/badges.ts 와 대조)
import re, sys
from pathlib import Path
from PIL import Image
ts = Path('lib/badges.ts').read_text(encoding='utf-8')
keys = re.findall(r"key: '([a-z0-9_]+)'", ts)
art = dict(re.findall(r"(\w+): '((?:record|streak|goal)-\d+)'", ts))
ok = 0; bad = 0
def check(name, cond, detail=''):
    global ok, bad
    print(('✅ ' if cond else '❌ ') + name + (f' — {detail}' if detail else ''))
    ok += cond; bad += (not cond)
check('배지 11종 정의', len(keys) == 11, str(len(keys)))
check('모든 배지 ID에 그림 매핑', set(keys) == set(art), str(set(keys) ^ set(art)))
check('그림 파일 이름 중복 없음', len(set(art.values())) == len(art))
for k in keys:
    p = Path(f'public/game/v22/badges/{art.get(k)}.png')
    if not p.exists():
        check(f'{k} 파일', False, str(p)); continue
    im = Image.open(p)
    a = im.getchannel('A') if im.mode == 'RGBA' else None
    check(f'{k} → {p.name}: 256×256 · 투명 배경', im.size == (256, 256) and a is not None and a.getpixel((0, 0)) == 0 and min(a.getdata()) == 0, f'{im.size} {im.mode}')
for c in ['char-m', 'char-f']:
    im = Image.open(f'public/game/v22/characters/{c}.png')
    check(f'캐릭터 {c}: 256×384(2:3, 화면에서 64×96 기준으로 줄여 그림) · 투명 배경', im.size == (256, 384) and im.mode == 'RGBA' and im.getchannel('A').getpixel((0, 0)) == 0, f'{im.size}')

# 나무 4단계(96×96) · 정원 장식(lib/game.ts DECOR 의 칸 수 × 4px)
for n in range(1, 5):
    f = Path(f'public/game/v22/tree/stage-{n}.png')
    im = Image.open(f) if f.exists() else None
    check(f'나무 stage-{n}: 320×320 · 투명 배경', bool(im) and im.size == (320, 320) and im.mode == 'RGBA' and im.getchannel('A').getpixel((0, 0)) == 0, str(im.size if im else '없음'))
g = Path('lib/game.ts').read_text(encoding='utf-8')
decor = re.findall(r"decor\('(\w+)', '[^']+', \d+(?:, (\d+), (\d+))?\)", g)
check('장식 8종 정의', len(decor) == 8, str(len(decor)))
for name, w, h in decor:
    w, h = int(w or 16), int(h or 16)
    f = Path(f'public/game/v22/decor/decor-{name}.png')
    im = Image.open(f) if f.exists() else None
    check(f'장식 decor-{name}: {w*8}×{h*8}(칸 {w}×{h}) · 투명 배경', bool(im) and im.size == (w * 8, h * 8) and im.mode == 'RGBA' and im.getchannel('A').getpixel((0, 0)) == 0, str(im.size if im else '없음'))
print(f'\n결과: {ok}/{ok + bad} 통과')
sys.exit(1 if bad else 0)
