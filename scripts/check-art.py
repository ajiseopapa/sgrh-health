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
    check(f'{k} → {p.name}: 64×64 · 투명 배경', im.size == (64, 64) and a is not None and a.getpixel((0, 0)) == 0 and min(a.getdata()) == 0, f'{im.size} {im.mode}')
for c in ['char-m', 'char-f']:
    im = Image.open(f'public/game/v22/characters/{c}.png')
    check(f'캐릭터 {c}: 64×96 · 투명 배경', im.size == (64, 96) and im.mode == 'RGBA' and im.getchannel('A').getpixel((0, 0)) == 0, f'{im.size}')
print(f'\n결과: {ok}/{ok + bad} 통과')
sys.exit(1 if bad else 0)
