# 움트다 나의 나무 4단계 픽셀 아트 (투명 PNG) — 개발자 임시 시안(디자이너 그림이 오면 같은 파일명으로 교체)
# 기준: 앱 아이콘(components/SproutIcon.tsx)과 scripts/make-game-art.py — 1칸 외곽선 #202D29, 2~3단 음영, 왼쪽 위 빛
# 사용법: python scripts/make-tree-art.py   → public/game/v22/tree/stage-{1..4}.png (24×24 격자 ×4 = 96×96), test-results/tree-sheet.png(검수용)
from pathlib import Path
from PIL import Image

OUT = Path('public/game/v22/tree')
N, SCALE = 24, 4
PAL = {
    '#': '#202D29',  # 외곽선
    'k': '#3C4743',  # 줄기
    'K': '#2C3632',  # 줄기 그늘
    'g': '#7B8780',  # 흙
    'G': '#5E6A64',  # 흙 그늘
    'l': '#D8F36A',  # 잎 밝은 면(라임)
    'L': '#C6E44A',  # 잎
    'a': '#A9C82E',  # 잎 그늘
    'd': '#7E9A1E',  # 잎 깊은 그늘
    'r': '#E86A5C',  # 열매
    'R': '#C24F43',  # 열매 그늘
}


def blank():
    return [['.'] * N for _ in range(N)]


def put(g, x, y, ch):
    if 0 <= x < N and 0 <= y < N:
        g[y][x] = ch


def leaf_ball(g, cx, cy, rx, ry=None):
    """잎 덩어리: 왼쪽 위는 밝게, 오른쪽 아래는 어둡게"""
    ry = ry or rx
    for y in range(N):
        for x in range(N):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            if dx * dx + dy * dy <= 1.0:
                t = dx + dy  # 왼쪽 위(-) → 오른쪽 아래(+)
                put(g, x, y, 'l' if t < -0.55 else 'L' if t < 0.25 else 'a' if t < 0.9 else 'd')


def trunk(g, x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(g, x, y, 'K' if (x == x1 and x1 > x0) else 'k')


def soil(g, x0, x1, y=21):
    for x in range(x0, x1 + 1):
        put(g, x, y, 'g')
    for x in range(x0 - 2, x1 + 3):
        put(g, x, y + 1, 'G' if x > (x0 + x1) // 2 + 2 else 'g')


def fruit(g, x, y):
    put(g, x, y, 'r'); put(g, x + 1, y, 'r'); put(g, x, y + 1, 'r'); put(g, x + 1, y + 1, 'R')


def outline(g):
    out = [row[:] for row in g]
    for y in range(N):
        for x in range(N):
            if g[y][x] != '.':
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < N and 0 <= ny < N and g[ny][nx] != '.':
                    out[y][x] = '#'
                    break
    return out


def leaf(g, cx, cy, a, b, deg):
    """기울어진 잎 한 장(길쭉한 타원). 위쪽 면은 밝게, 아래쪽 면은 어둡게"""
    import math
    c, s_ = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    for y in range(N):
        for x in range(N):
            dx, dy = x - cx, y - cy
            u, v = (dx * c + dy * s_) / a, (-dx * s_ + dy * c) / b
            if u * u + v * v <= 1.0:
                put(g, x, y, 'l' if v < -0.25 else 'L' if v < 0.45 else 'a')


def stage1():  # 새싹: 가는 줄기에 잎 두 장(앱 아이콘과 같은 모양)
    g = blank()
    soil(g, 8, 15)
    trunk(g, 11, 12, 13, 20)
    leaf(g, 7.0, 12.0, 4.4, 2.1, 28)     # 왼쪽 잎: 왼쪽 위로
    leaf(g, 16.5, 9.5, 5.4, 2.6, -34)    # 오른쪽 잎: 오른쪽 위로, 조금 더 큼
    return g


def stage2():  # 어린 나무: 가는 줄기 + 둥근 잎 덩어리
    g = blank()
    soil(g, 7, 16)
    trunk(g, 11, 12, 11, 20)
    leaf_ball(g, 11.5, 8, 6.2, 5.6)
    leaf_ball(g, 7, 11, 3.2, 2.8)
    leaf_ball(g, 16.5, 11.5, 3.0, 2.6)
    return g


def stage3():  # 나무: 굵어진 줄기 + 잎 덩어리 셋
    g = blank()
    soil(g, 6, 17)
    trunk(g, 10, 13, 12, 20)
    put(g, 9, 20, 'k'); put(g, 14, 20, 'K')  # 뿌리
    leaf_ball(g, 11.5, 6.5, 6.6, 5.4)
    leaf_ball(g, 6, 10.5, 4.6, 4.0)
    leaf_ball(g, 17.5, 10.5, 4.6, 4.0)
    leaf_ball(g, 11.5, 11, 4.2, 3.0)
    return g


def stage4():  # 큰 나무: 넓은 수관 + 열매
    g = blank()
    soil(g, 5, 18)
    trunk(g, 9, 14, 13, 20)
    put(g, 8, 20, 'k'); put(g, 7, 20, 'k'); put(g, 15, 20, 'K'); put(g, 16, 20, 'K')
    put(g, 8, 19, 'k'); put(g, 15, 19, 'K')
    leaf_ball(g, 11.5, 5.5, 7.4, 4.9)
    leaf_ball(g, 5, 9.5, 4.6, 4.4)
    leaf_ball(g, 18.5, 9.5, 4.6, 4.4)
    leaf_ball(g, 8.5, 12, 4.4, 3.2)
    leaf_ball(g, 15, 12, 4.4, 3.2)
    fruit(g, 6, 8); fruit(g, 14, 5); fruit(g, 17, 11); fruit(g, 10, 11)
    return g


def render(g, scale=SCALE):
    img = Image.new('RGBA', (N * scale, N * scale), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            c = PAL[ch]
            rgba = tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
            for i in range(scale):
                for j in range(scale):
                    px[x * scale + i, y * scale + j] = rgba
    return img


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    imgs = []
    for n, fn in enumerate((stage1, stage2, stage3, stage4), 1):
        img = render(outline(fn()))
        img.save(OUT / f'stage-{n}.png')
        imgs.append(img)
    # 검수용: 연두 카드색·종이색 바탕 위에 크게
    sheet = Image.new('RGBA', (4 * 240, 2 * 240), '#F6F4EE')
    for row, bg in enumerate(('#D8F36A', '#F8FDE6')):
        for i, img in enumerate(imgs):
            tile = Image.new('RGBA', (240, 240), bg)
            big = img.resize((192, 192), Image.NEAREST)
            tile.alpha_composite(big, (24, 24))
            sheet.alpha_composite(tile, (i * 240, row * 240))
    sheet.convert('RGB').save(Path('test-results/tree-sheet.png'))  # 검수용은 배포 폴더(public) 밖에
    print('ok', [p.name for p in sorted(OUT.glob('*.png'))])
