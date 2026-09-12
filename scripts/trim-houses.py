from PIL import Image

# 裁掉每张透明 PNG 四周多余的透明边距，让房子占满图
def trim(path, margin=8):
    im = Image.open(path).convert('RGBA')
    bbox = im.getbbox()  # 非透明区域边界
    if not bbox:
        print('empty', path)
        return
    l, t, r, b = bbox
    # 四周留一点边距
    l = max(0, l - margin)
    t = max(0, t - margin)
    r = min(im.width, r + margin)
    b = min(im.height, b + margin)
    im.crop((l, t, r, b)).save(path)
    print('trimmed', path, '->', (r-l, b-t))

for i in [1, 2, 3, 4]:
    trim(f'public/warehouses/house-{i}.png')
