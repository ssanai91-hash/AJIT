#!/usr/bin/env python3
"""배경 v2: 윗단 가운데 칸을 '귀빈석' 고급 진열장으로 다시 그린다 (실제 브랜드 디자인 없음, 전부 오리지널 도형)."""
import sys
from PIL import Image, ImageDraw, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
S = 4                                  # 4배로 그려서 줄이면 경계가 매끈
X0, Y0, X1, Y1 = 642, 128, 968, 276    # 칸 내부 (원본 좌표)
W, H = (X1 - X0) * S, (Y1 - Y0) * S
OUTLINE = (42, 24, 16, 255)

def lay(): return Image.new('RGBA', (W, H), (0, 0, 0, 0))
def vgrad(w, h, top, bot):
    g = Image.new('RGBA', (w, h))
    px = g.load()
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(4))
        for x in range(w): px[x, y] = c
    return g
def hgrad(w, h, l, r):
    return vgrad(h, w, l, r).transpose(Image.Transpose.ROTATE_270).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
def masked(fill, mask):
    out = Image.new('RGBA', mask.size, (0, 0, 0, 0)); out.paste(fill, (0, 0), mask); return out
def shape_mask(draw_fn):
    m = Image.new('L', (W, H), 0); draw_fn(ImageDraw.Draw(m)); return m

base = Image.open(SRC).convert('RGBA')
canvas = lay()

# 1) 거울 뒷판 + 따뜻한 어둠
back = vgrad(W, H, (30, 20, 14, 255), (44, 28, 18, 255))
canvas.alpha_composite(back)
sheen = lay(); d = ImageDraw.Draw(sheen)
for k in range(5):
    x = int(W * (0.1 + k * 0.21))
    d.polygon([(x, 0), (x + 30 * S, 0), (x - 40 * S, H), (x - 70 * S, H)], fill=(255, 235, 200, 10))
canvas.alpha_composite(sheen.filter(ImageFilter.GaussianBlur(6 * S)))

items = [0.15, 0.39, 0.62, 0.86]       # 진열품 가운데 x (칸 폭 비율)
FLOOR = H - 14 * S                      # 벨벳 받침 윗면

# 2) 칸마다 스포트 조명
spot = lay(); d = ImageDraw.Draw(spot)
for fx in items:
    cx = int(W * fx)
    d.polygon([(cx - 9 * S, 0), (cx + 9 * S, 0), (cx + 44 * S, FLOOR), (cx - 44 * S, FLOOR)], fill=(255, 214, 150, 46))
    d.ellipse([cx - 46 * S, FLOOR - 8 * S, cx + 46 * S, FLOOR + 8 * S], fill=(255, 200, 120, 70))
canvas.alpha_composite(spot.filter(ImageFilter.GaussianBlur(5 * S)))
lamps = lay(); d = ImageDraw.Draw(lamps)
for fx in items:
    cx = int(W * fx); d.rounded_rectangle([cx - 10 * S, 0, cx + 10 * S, 4 * S], 2 * S, fill=(255, 236, 190, 255))
canvas.alpha_composite(lamps)

# 진열품 뒤 따뜻한 역광
glow = lay(); d = ImageDraw.Draw(glow)
for fx in items:
    cx = int(W * fx); d.ellipse([cx - 40 * S, FLOOR - 100 * S, cx + 40 * S, FLOOR - 4 * S], fill=(255, 170, 80, 60))
canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14 * S)))
# 3) 벨벳 받침 (버건디)
velvet = lay(); d = ImageDraw.Draw(velvet)
d.rectangle([0, FLOOR, W, H], fill=(98, 24, 34, 255))
d.rectangle([0, FLOOR, W, FLOOR + 2 * S], fill=(150, 52, 60, 255))
canvas.alpha_composite(velvet)

def outline_of(mask, width=1):
    big = mask.filter(ImageFilter.MaxFilter(width * S * 2 + 1))
    ring = Image.new('L', mask.size, 0); ring.paste(big); 
    from PIL import ImageChops
    ring = ImageChops.subtract(big, mask)
    o = Image.new('RGBA', mask.size, OUTLINE); return masked(o, ring)

def put(fill_layers, mask, shadow=True):
    if shadow:
        sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sh.paste((0, 0, 0, 110), (6 * S, 3 * S), mask)
        canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(4 * S)))
    for f in fill_layers: canvas.alpha_composite(masked(f, mask))
    canvas.alpha_composite(outline_of(mask))

GOLD = [(255, 222, 140, 255), (176, 120, 40, 255)]
AMBER = [(232, 150, 60, 255), (150, 70, 20, 255)]

# ── 진열품 1: 크리스털 디캔터 (둥근 몸통·면 처리·금 마개)
cx = int(W * items[0]); bw, bh = 34 * S, 36 * S; by = FLOOR - bh
body = shape_mask(lambda d: (d.ellipse([cx - bw, by, cx + bw, FLOOR], fill=255)))
neck = shape_mask(lambda d: d.rectangle([cx - 8 * S, by - 22 * S, cx + 8 * S, by + 6 * S], fill=255))
glass = vgrad(W, H, (255, 236, 205, 70), (230, 190, 140, 110))
liquid = vgrad(W, H, AMBER[0], AMBER[1])
liq_mask = shape_mask(lambda d: d.ellipse([cx - bw + 4 * S, by + 4 * S, cx + bw - 4 * S, FLOOR - 3 * S], fill=255))
liq_mask.paste(0, (0, 0, W, by + 14 * S))
from PIL import ImageChops
put([glass], ImageChops.lighter(body, neck))
canvas.alpha_composite(masked(liquid, liq_mask))
fac = lay(); d = ImageDraw.Draw(fac)
for k in range(-3, 4):
    d.line([(cx + k * 9 * S, by + 4 * S), (cx + k * 11 * S, FLOOR - 4 * S)], fill=(255, 255, 255, 45), width=S)
d.ellipse([cx - bw + 8 * S, by + 8 * S, cx - bw + 16 * S, by + 26 * S], fill=(255, 255, 255, 150))
canvas.alpha_composite(masked(fac, body))
stopper = shape_mask(lambda d: (d.ellipse([cx - 11 * S, by - 42 * S, cx + 11 * S, by - 20 * S], fill=255)))
put([vgrad(W, H, (255, 246, 226, 190), (210, 170, 120, 210))], stopper, False)
collar = shape_mask(lambda d: d.rectangle([cx - 10 * S, by - 22 * S, cx + 10 * S, by - 16 * S], fill=255))
put([vgrad(W, H, *GOLD)], collar, False)

# ── 진열품 2: 원목 선물 상자 + 사각 크리스털 병
cx = int(W * items[1]); bw = 30 * S; top = FLOOR - 104 * S
box = shape_mask(lambda d: d.rectangle([cx - bw, top, cx + bw, FLOOR], fill=255))
put([hgrad(W, H, (122, 72, 38, 255), (70, 38, 20, 255))], box)
inner = shape_mask(lambda d: d.rectangle([cx - bw + 6 * S, top + 6 * S, cx + bw - 6 * S, FLOOR - 6 * S], fill=255))
canvas.alpha_composite(masked(vgrad(W, H, (40, 22, 12, 255), (66, 36, 20, 255)), inner))
sat = shape_mask(lambda d: d.rectangle([cx - bw + 6 * S, FLOOR - 16 * S, cx + bw - 6 * S, FLOOR - 6 * S], fill=255))
canvas.alpha_composite(masked(Image.new('RGBA', (W, H), (120, 30, 40, 255)), sat))
bt = shape_mask(lambda d: (d.rectangle([cx - 14 * S, top + 30 * S, cx + 14 * S, FLOOR - 16 * S], fill=255),
                           d.polygon([(cx - 14 * S, top + 30 * S), (cx - 5 * S, top + 20 * S), (cx + 5 * S, top + 20 * S), (cx + 14 * S, top + 30 * S)], fill=255),
                           d.rectangle([cx - 5 * S, top + 12 * S, cx + 5 * S, top + 21 * S], fill=255)))
put([vgrad(W, H, (245, 170, 80, 255), (140, 60, 18, 255))], bt, False)
lab = shape_mask(lambda d: d.rectangle([cx - 11 * S, top + 52 * S, cx + 11 * S, top + 66 * S], fill=255))
put([vgrad(W, H, (40, 26, 18, 255), (20, 14, 10, 255))], lab, False)
emb = lay(); d = ImageDraw.Draw(emb); d.ellipse([cx - 4 * S, top + 55 * S, cx + 4 * S, top + 63 * S], outline=GOLD[0], width=S)
canvas.alpha_composite(emb)
cap = shape_mask(lambda d: d.rectangle([cx - 6 * S, top + 8 * S, cx + 6 * S, top + 14 * S], fill=255))
put([vgrad(W, H, *GOLD)], cap, False)
plate = shape_mask(lambda d: d.rounded_rectangle([cx - 12 * S, FLOOR - 30 * S + 10 * S, cx + 12 * S, FLOOR - 22 * S + 10 * S], 2 * S, fill=255))
canvas.alpha_composite(masked(vgrad(W, H, *GOLD), plate))
hl = lay(); d = ImageDraw.Draw(hl); d.line([(cx - 10 * S, top + 32 * S), (cx - 10 * S, FLOOR - 22 * S)], fill=(255, 255, 255, 120), width=2 * S)
canvas.alpha_composite(masked(hl, bt))

# ── 진열품 3: 달항아리 도자기 병 (금 테두리·붉은 밀랍)
cx = int(W * items[2]); bw, bh = 34 * S, 66 * S; by = FLOOR - bh
jar = shape_mask(lambda d: (d.ellipse([cx - bw, by + 6 * S, cx + bw, FLOOR], fill=255),
                            d.rectangle([cx - 10 * S, by - 6 * S, cx + 10 * S, by + 14 * S], fill=255)))
put([hgrad(W, H, (250, 245, 232, 255), (196, 186, 170, 255))], jar)
glaze = lay(); d = ImageDraw.Draw(glaze)
d.ellipse([cx - bw + 7 * S, by + 16 * S, cx - bw + 17 * S, by + 40 * S], fill=(255, 255, 255, 170))
d.ellipse([cx + 8 * S, by + 30 * S, cx + bw - 4 * S, FLOOR - 4 * S], fill=(150, 120, 90, 40))
canvas.alpha_composite(masked(glaze, jar))
wax = shape_mask(lambda d: (d.rounded_rectangle([cx - 12 * S, by - 12 * S, cx + 12 * S, by - 2 * S], 3 * S, fill=255),
                            d.polygon([(cx - 8 * S, by - 2 * S), (cx - 5 * S, by + 8 * S), (cx - 2 * S, by - 2 * S)], fill=255),
                            d.polygon([(cx + 4 * S, by - 2 * S), (cx + 7 * S, by + 5 * S), (cx + 10 * S, by - 2 * S)], fill=255)))
put([vgrad(W, H, (200, 50, 50, 255), (120, 20, 26, 255))], wax, False)
ring = shape_mask(lambda d: d.rectangle([cx - 11 * S, by + 4 * S, cx + 11 * S, by + 8 * S], fill=255))
canvas.alpha_composite(masked(vgrad(W, H, *GOLD), ring))

# ── 진열품 4: 사각 크리스털 병 (각진 어깨·금박 띠·밀랍 봉인)
cx = int(W * items[3]); bw, top = 20 * S, FLOOR - 92 * S
sq = shape_mask(lambda d: (d.polygon([(cx - bw, FLOOR), (cx - bw, top + 30 * S), (cx - 7 * S, top + 16 * S), (cx + 7 * S, top + 16 * S), (cx + bw, top + 30 * S), (cx + bw, FLOOR)], fill=255),
                           d.rectangle([cx - 6 * S, top, cx + 6 * S, top + 18 * S], fill=255)))
put([vgrad(W, H, (255, 236, 205, 70), (230, 190, 140, 110))], sq)
lq = shape_mask(lambda d: d.rectangle([cx - bw + 4 * S, top + 40 * S, cx + bw - 4 * S, FLOOR - 4 * S], fill=255))
canvas.alpha_composite(masked(vgrad(W, H, (210, 120, 40, 255), (110, 45, 16, 255)), lq))
band = shape_mask(lambda d: d.rectangle([cx - bw, top + 52 * S, cx + bw, top + 64 * S], fill=255))
put([vgrad(W, H, *GOLD)], band, False)
dots = lay(); d = ImageDraw.Draw(dots)
for k in range(-2, 3): d.rectangle([cx + k * 6 * S - S, top + 57 * S, cx + k * 6 * S + S, top + 59 * S], fill=(90, 50, 16, 255))
canvas.alpha_composite(dots)
seal = shape_mask(lambda d: (d.ellipse([cx - 8 * S, top - 6 * S, cx + 8 * S, top + 8 * S], fill=255),
                             d.polygon([(cx - 4 * S, top + 6 * S), (cx - 2 * S, top + 16 * S), (cx + 1 * S, top + 6 * S)], fill=255)))
put([vgrad(W, H, (200, 50, 50, 255), (120, 20, 26, 255))], seal, False)
hl = lay(); d = ImageDraw.Draw(hl)
d.line([(cx - bw + 5 * S, top + 34 * S), (cx - bw + 5 * S, FLOOR - 8 * S)], fill=(255, 255, 255, 150), width=2 * S)
canvas.alpha_composite(masked(hl, sq))

# 4) 유리문 반사 + 황동 문틀
glass = lay(); d = ImageDraw.Draw(glass)
d.polygon([(int(W * 0.05), 0), (int(W * 0.13), 0), (int(W * 0.0), H), (0, H)], fill=(255, 245, 230, 22))
d.polygon([(int(W * 0.55), 0), (int(W * 0.6), 0), (int(W * 0.48), H), (int(W * 0.45), H)], fill=(255, 245, 230, 16))
canvas.alpha_composite(glass.filter(ImageFilter.GaussianBlur(2 * S)))
frame = lay(); d = ImageDraw.Draw(frame)
d.rectangle([int(W / 2) - S, 0, int(W / 2) + S, FLOOR], fill=(196, 150, 70, 200))
canvas.alpha_composite(frame)

# 5) 원본에 합성: 그림 느낌이 나도록 살짝 뭉개고 따뜻한 색조 + 미세 질감
import random
small = canvas.resize((X1 - X0, Y1 - Y0), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.35))
warm = Image.new('RGBA', small.size, (255, 170, 90, 22)); small.alpha_composite(warm)
noise = Image.effect_noise(small.size, 18).convert('L')
small = Image.composite(small, Image.blend(small, Image.merge('RGBA', (noise, noise, noise, small.getchannel('A'))), 0.06), Image.new('L', small.size, 230))
m = Image.new('L', small.size, 255)
base.alpha_composite(small, (X0, Y0))
# 칸 위에 '귀빈석' 황동 명판
pl = Image.new('RGBA', base.size, (0, 0, 0, 0)); d = ImageDraw.Draw(pl)
cxp = (X0 + X1) // 2
d.rounded_rectangle([cxp - 34, Y1 + 3, cxp + 34, Y1 + 13], 3, fill=(196, 150, 70, 255), outline=(90, 56, 20, 255))
d.line([(cxp - 26, Y1 + 8), (cxp + 26, Y1 + 8)], fill=(110, 70, 26, 255), width=1)
base.alpha_composite(pl)
base.convert('RGB').save(OUT, quality=90)
print('saved', OUT)
