# 디자이너 납품 그림 검수 — 폴더를 넣으면 장마다 통과/불통과를 표로 냅니다.
#   기준: docs/design-requests/움트다-캐릭터-그림-기준서.md
#   쓰는 법:  python scripts/check-delivery.py <납품 폴더>
#   결과:    화면에 요약 + <납품 폴더>/_검수결과.md + <납품 폴더>/_검수모음.png
#
# 검사 항목(전신 그림 512×768):
#   ① 파일 이름  look-<칸>-<키>-<m|f>.png 또는 char-<m|f>-workout.png, 키는 lib/game.ts 목록에 있어야 함
#   ② 크기      512×768
#   ③ 반투명    반투명 픽셀 0개 (완전히 불투명하거나 완전히 투명)
#   ④ 발        발바닥 마지막 줄 y=755
#   ⑤ 머리      0~364행이 기준 머리(design/head-<m|f>-2026-11-20.png)와 픽셀까지 같음
#               (모자·머리 장식·안경·특별·조리복은 머리를 덮으므로 '예외'로 표시만)
#   ⑥ 떠 있는 점 몸에서 떨어진 50픽셀 미만 조각 0개
# 사람 눈으로 봐야 하는 것(번짐, 디자인, 사원증 유무)은 검사하지 못합니다. 모음 그림으로 확인하세요.
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
HEAD_ROWS = 365
FOOT_Y = 755
SIZE = (512, 768)
HEAD_COVER_SLOTS = {'hat', 'hair', 'face', 'effect'}  # 머리를 덮어도 되는 칸
HEAD_COVER_KEYS = {'top_chef'}                         # 조리모


def load_items():
    g = (ROOT / 'lib/game.ts').read_text(encoding='utf-8')
    keys = {f'{s}_{i}' for s, i in re.findall(r"item\('(\w+)', '(\w+)', '[^']+', \d+\)", g)}
    keys |= {f'top_{i}' for i in re.findall(r"uniform\('(\w+)', '[^']+', \d+\)", g)}
    return keys


def load_heads():
    heads = {}
    for g in 'mf':
        p = ROOT / f'design/head-{g}-2026-11-20.png'
        heads[g] = np.array(Image.open(p).convert('RGBA'))[:HEAD_ROWS].astype(int) if p.exists() else None
    return heads


def parse_name(name, keys):
    m = re.fullmatch(r'char-([mf])-workout\.png', name)
    if m:
        return m.group(1), 'workout', None
    m = re.fullmatch(r'look-([a-z]+)-([a-z]+)-([mf])\.png', name)
    if not m:
        g = re.search(r'-([mf])\.png$', name)
        return (g.group(1) if g else None), None, '이름 규칙 밖 (look-<칸>-<키>-<m|f>.png)'
    slot, key, g = m.groups()
    if f'{slot}_{key}' not in keys:
        return g, f'{slot}_{key}', f'목록에 없는 키 {slot}_{key}'
    return g, f'{slot}_{key}', None


def check(path, keys, heads):
    rows = []  # (항목, 통과여부 True/False/None(예외), 설명)
    g, key, name_err = parse_name(path.name, keys)
    rows.append(('이름', name_err is None, name_err or ''))
    im = Image.open(path)
    a = np.array(im.convert('RGBA'))
    rows.append(('크기', im.size == SIZE, f'{im.size[0]}×{im.size[1]}' if im.size != SIZE else ''))
    if im.size != SIZE:
        return rows
    al = a[..., 3]
    semi = int(((al > 0) & (al < 255)).sum())
    rows.append(('반투명', semi == 0, f'{semi}픽셀' if semi else ''))
    ys = np.where(al.any(1))[0]
    foot = int(ys.max()) if len(ys) else -1
    rows.append(('발', foot == FOOT_Y, f'마지막 줄 y={foot}' if foot != FOOT_Y else ''))
    covers = key and (key.split('_')[0] in HEAD_COVER_SLOTS or key in HEAD_COVER_KEYS)
    if g not in heads or heads.get(g) is None:
        rows.append(('머리', False, '남녀(m/f)를 알 수 없거나 기준 머리 파일 없음'))
    else:
        diff = np.abs(a[:HEAD_ROWS].astype(int) - heads[g]).max(-1) > 0
        n = int(diff.sum())
        if covers:
            rows.append(('머리', None, f'예외(머리에 쓰는 것) · 다른 픽셀 {n}'))
        else:
            first = int(np.where(diff.any(1))[0].min()) if n else -1
            rows.append(('머리', n == 0, f'다른 픽셀 {n}개 (처음 다른 줄 y={first})' if n else ''))
    lab, cnt = ndimage.label(al > 0)
    sizes = ndimage.sum(np.ones_like(al), lab, range(1, cnt + 1)) if cnt else []
    spots = int((np.asarray(sizes) < 50).sum())
    rows.append(('떠 있는 점', spots == 0, f'{spots}개' if spots else ''))
    return rows


def main():
    if len(sys.argv) < 2:
        print('쓰는 법: python scripts/check-delivery.py <납품 폴더>')
        sys.exit(2)
    folder = Path(sys.argv[1])
    files = sorted(p for p in folder.rglob('*.png') if not p.name.startswith('_'))
    keys, heads = load_items(), load_heads()
    results = [(p, check(p, keys, heads)) for p in files]
    passed = [p for p, r in results if all(ok is not False for _, ok, _ in r)]

    lines = [f'# 납품 그림 검수 결과', '', f'폴더: `{folder}`', '',
             f'**{len(files)}장 중 {len(passed)}장 통과, {len(files) - len(passed)}장 불통과**', '',
             '| 파일 | 결과 | 걸린 항목 |', '| --- | --- | --- |']
    for p, r in results:
        bad = [f'{k}: {d}' for k, ok, d in r if ok is False]
        note = [f'{k}: {d}' for k, ok, d in r if ok is None]
        lines.append(f'| {p.relative_to(folder)} | {"✅" if not bad else "❌"} | {" · ".join(bad + note)} |')
    lines += ['', '검사 항목: 이름 · 크기 512×768 · 반투명 0 · 발 y=755 · 머리 0~364행 기준과 같음 · 떠 있는 점 0',
              '번짐·디자인·사원증은 `_검수모음.png`를 눈으로 확인하세요.']
    (folder / '_검수결과.md').write_text('\n'.join(lines), encoding='utf-8')

    # 모음 그림: 불통과는 빨간 테두리
    font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 12) if Path('C:/Windows/Fonts/malgun.ttf').exists() else ImageFont.load_default()
    W, H, cols = 128, 192, 8
    rows_n = (len(results) + cols - 1) // cols or 1
    sheet = Image.new('RGB', (cols * (W + 12) + 12, rows_n * (H + 40) + 12), (244, 246, 248))
    d = ImageDraw.Draw(sheet)
    for i, (p, r) in enumerate(results):
        x, y = 12 + (i % cols) * (W + 12), 12 + (i // cols) * (H + 40)
        ok = all(o is not False for _, o, _ in r)
        d.rectangle([x - 3, y - 3, x + W + 2, y + H + 2], outline=(30, 160, 90) if ok else (220, 40, 40), width=3)
        t = Image.open(p).convert('RGBA'); t.thumbnail((W, H))
        sheet.paste(t, (x + (W - t.width) // 2, y + (H - t.height) // 2), t)
        d.text((x, y + H + 6), p.stem[:22], fill=(20, 20, 20), font=font)
    sheet.save(folder / '_검수모음.png')

    print(f'{len(files)}장 중 {len(passed)}장 통과, {len(files) - len(passed)}장 불통과')
    for p, r in results:
        bad = [f'{k}({d})' if d else k for k, ok, d in r if ok is False]
        if bad:
            print(f'  ❌ {p.relative_to(folder)} — {", ".join(bad)}')
    print(f'자세한 결과: {folder / "_검수결과.md"}')
    print(f'모음 그림:   {folder / "_검수모음.png"}')
    sys.exit(0 if len(passed) == len(files) else 1)


if __name__ == '__main__':
    main()
