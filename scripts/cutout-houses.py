from PIL import Image
from collections import deque

def cutout(path, tol=28):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()
    visited = [[False] * w for _ in range(h)]
    seeds = [(0,0),(w-1,0),(0,h-1),(w-1,h-1),
             (w//2,0),(w//2,h-1),(0,h//2),(w-1,h//2)]
    q = deque()
    for sx, sy in seeds:
        r, g, b, a = px[sx, sy]
        q.append((sx, sy, r, g, b))
    while q:
        x, y, br, bg, bb = q.popleft()
        if x < 0 or x >= w or y < 0 or y >= h or visited[y][x]:
            continue
        visited[y][x] = True
        r, g, b, a = px[x, y]
        if abs(r-br) <= tol and abs(g-bg) <= tol and abs(b-bb) <= tol and a > 0:
            px[x, y] = (r, g, b, 0)
            q.append((x+1, y, br, bg, bb))
            q.append((x-1, y, br, bg, bb))
            q.append((x, y+1, br, bg, bb))
            q.append((x, y-1, br, bg, bb))
    im.save(path)
    print('saved', path)

for i in [1, 2, 3, 4]:
    cutout(f'public/warehouses/house-{i}.png')
