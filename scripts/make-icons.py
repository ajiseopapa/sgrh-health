# 움트다 앱 아이콘 PNG 만들기 (components/SproutIcon.tsx 와 같은 격자)
# 사용법: python scripts/make-icons.py   → app/icon.png(32), app/apple-icon.png(180), public/icon-512.png
from PIL import Image

GRID = [
    '............',
    '........##..',
    '.##....#cc#.',
    '#bb#..#cccc#',
    '#abb#.#ccc#.',
    '.#aab#scc#..',
    '..##.ss##...',
    '.....ss.....',
    '...######...',
    '.##dddddd##.',
    '#dddddddddd#',
    '############',
]
COLORS = {'#': '#202D29', 'a': '#A9C82E', 'b': '#C6E44A', 'c': '#D8F36A', 's': '#3C4743', 'd': '#7B8780'}
BG = '#F6F4EE'


def make(size, pad_ratio, path):
    n = len(GRID)
    cell = max(1, int(size * (1 - 2 * pad_ratio)) // n)
    art = n * cell
    img = Image.new('RGB', (size, size), BG)
    ox = (size - art) // 2
    oy = (size - art) // 2
    for y, row in enumerate(GRID):
        for x, ch in enumerate(row):
            if ch in COLORS:
                for i in range(cell):
                    for j in range(cell):
                        img.putpixel((ox + x * cell + i, oy + y * cell + j), Image.new('RGB', (1, 1), COLORS[ch]).getpixel((0, 0)))
    img.save(path)
    print(path, size)


make(32, 0.03, 'app/icon.png')
make(180, 0.12, 'app/apple-icon.png')
make(512, 0.12, 'public/icon-512.png')
