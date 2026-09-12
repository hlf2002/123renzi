from PIL import Image

# 统一四张房子图到相同画布，房子缩放到等高、贴底居中
CANVAS_W, CANVAS_H = 860, 680
TARGET_H = 660

def normalize(path):
    im = Image.open(path).convert('RGBA')
    # 按目标高度等比缩放
    scale = TARGET_H / im.height
    new_w = int(im.width * scale)
    new_h = TARGET_H
    im = im.resize((new_w, new_h), Image.LANCZOS)
    # 放到统一画布，水平居中、贴底
    canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    x = (CANVAS_W - new_w) // 2
    y = CANVAS_H - new_h
    canvas.paste(im, (x, y), im)
    canvas.save(path)
    print('normalized', path, canvas.size)

for i in [1, 2, 3, 4]:
    normalize(f'public/warehouses/house-{i}.png')
