#!/usr/bin/env python3
"""
임시 도트 에셋 생성기 — GPT 동생의 그림이 오기 전까지 쓰는 대체 그림.
규격서 v0.1의 크기·시트 배치·팔레트를 그대로 지키므로, 나중에 같은 파일 이름의 진짜 그림으로 교체하면 된다.
출력: assets/*.png (+ assets/_preview_scene.png 확인용)
"""
from pathlib import Path
from PIL import Image

OUT_DIR = Path(__file__).resolve().parent.parent / 'assets'
OUT_DIR.mkdir(exist_ok=True)

def hx(s):
    s = s.lstrip('#'); return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)

# 규격서 1-5 기본 16색
OUT = hx('1a1210'); W0 = hx('3b2418'); W1 = hx('6b3f24'); W2 = hx('9a6236')
A0 = hx('b5651d'); A1 = hx('e09a3e'); A2 = hx('f4c86a'); A3 = hx('fff1c4')
LIQ = hx('c8741f'); GLS = hx('a9c6c9'); G0 = hx('1f2e2a'); G1 = hx('35503f')
RED = hx('7a2a2a'); SK0 = hx('b0705a'); SK1 = hx('e0a585'); SK2 = hx('f6d2b5')
# 키 색 (화면에서 변형으로 교체) — shared/layout.ts HAIR_RAMPS[0], SHIRT_RAMPS[0]
H = [hx('241c1c'), hx('3d2e2a'), hx('5a4238')]
S = [hx('1c2440'), hx('2e3d6a'), hx('4a64a0')]
BLUSH = hx('d8806a'); MOUTH = hx('7a2a2a'); PANTS = W0; T = (0, 0, 0, 0)

class Canvas:
    def __init__(self, w, h):
        self.im = Image.new('RGBA', (w, h), T); self.px = self.im.load(); self.w, self.h = w, h
    def p(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h: self.px[x, y] = c
    def rect(self, x0, y0, x1, y1, c):  # 포함 범위
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.p(x, y, c)
    def get(self, x, y):
        return self.px[x, y] if 0 <= x < self.w and 0 <= y < self.h else T
    def line(self, x0, y0, x1, y1, c, thick=1):
        dx, dy = abs(x1 - x0), -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; e = dx + dy
        while True:
            self.rect(x0, y0, x0 + thick - 1, y0 + thick - 1, c)
            if x0 == x1 and y0 == y1: break
            e2 = 2 * e
            if e2 >= dy: e += dy; x0 += sx
            if e2 <= dx: e += dx; y0 += sy
    def outline(self, color=OUT):
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.px[x, y][3] == 0 and any(self.get(x + a, y + b)[3] and self.get(x + a, y + b) != color
                                                for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    add.append((x, y))
        for x, y in add: self.px[x, y] = color

# ── 캐릭터 ─────────────────────────────────────────────

STYLES = {  # charId: (머리 모양, 액세서리)
    1: ('short', None), 2: ('long', None), 3: ('bun', None), 4: ('spiky', None), 5: ('bob', None), 6: ('beanie', None),
    7: ('short', 'glasses'), 8: ('long', 'glasses'), 9: ('bun', 'glasses'), 10: ('spiky', 'beard'),
    11: ('bob', 'glasses'), 12: ('beanie', 'beard'),
}

def glass_in_hand(c, x, y):
    """손에 든 작은 잔 3×4"""
    c.rect(x, y, x + 2, y + 3, GLS); c.rect(x, y + 2, x + 2, y + 3, LIQ); c.p(x, y, A3)

def hair_front(c, style, dy):
    y = dy
    if style == 'beanie':
        c.rect(5, 1 + y, 18, 6 + y, RED); c.rect(6, 0 + y, 17, 0 + y, RED); c.rect(5, 6 + y, 18, 7 + y, hx('a83a4c'))
        c.rect(5, 8 + y, 6, 10 + y, H[1]); c.rect(17, 8 + y, 18, 10 + y, H[1])
        return
    c.rect(5, 3 + y, 18, 6 + y, H[1]); c.rect(6, 2 + y, 17, 2 + y, H[1])
    c.rect(5, 7 + y, 6, 9 + y, H[1]); c.rect(17, 7 + y, 18, 9 + y, H[1])
    c.rect(7, 7 + y, 9, 7 + y, H[1]); c.rect(8, 3 + y, 11, 3 + y, H[2])  # 앞머리·하이라이트
    if style == 'long':
        c.rect(4, 7 + y, 6, 19 + y, H[1]); c.rect(17, 7 + y, 19, 19 + y, H[1]); c.rect(4, 15 + y, 4, 19 + y, H[0]); c.rect(19, 15 + y, 19, 19 + y, H[0])
    if style == 'bun':
        c.rect(10, -1 + y, 13, 2 + y, H[1]); c.rect(11, -1 + y, 12, -1 + y, H[2])
    if style == 'spiky':
        for i, x in enumerate(range(5, 19, 3)): c.rect(x, 0 + y, x + 1, 2 + y, H[1]); c.p(x, 0 + y, H[2])
        c.rect(14, 7 + y, 16, 7 + y, H[1])
    if style == 'bob':
        c.rect(4, 7 + y, 6, 14 + y, H[1]); c.rect(17, 7 + y, 19, 14 + y, H[1]); c.rect(7, 7 + y, 16, 7 + y, H[1])

def hair_side(c, style, dy):
    y = dy
    if style == 'beanie':
        c.rect(6, 1 + y, 18, 6 + y, RED); c.rect(7, 0 + y, 16, 0 + y, RED); c.rect(6, 6 + y, 18, 7 + y, hx('a83a4c'))
        c.rect(6, 8 + y, 9, 11 + y, H[1]); return
    c.rect(6, 3 + y, 18, 6 + y, H[1]); c.rect(7, 2 + y, 16, 2 + y, H[1]); c.rect(6, 7 + y, 10, 11 + y, H[1])
    c.rect(16, 7 + y, 18, 7 + y, H[1]); c.rect(10, 3 + y, 14, 3 + y, H[2])
    if style == 'long': c.rect(5, 7 + y, 9, 20 + y, H[1]); c.rect(5, 16 + y, 5, 20 + y, H[0])
    if style == 'bun': c.rect(3, 3 + y, 6, 7 + y, H[1]); c.p(4, 3 + y, H[2])
    if style == 'spiky':
        for x in range(7, 19, 3): c.rect(x, 0 + y, x + 1, 2 + y, H[1])
    if style == 'bob': c.rect(5, 7 + y, 10, 14 + y, H[1])

def bob(anim, f):
    return {'idle': [0, 0, 1, 0], 'sleep': [1, 2]}.get(anim, [0] * 4)[f]

def draw_front(style, acc, anim, f):
    c = Canvas(24, 32)
    dy = bob(anim, f)
    # 뒷머리(긴 머리)는 몸 뒤
    # 몸
    c.rect(8, 17 + dy, 15, 17 + dy, S[1]); c.rect(6, 18 + dy, 17, 27, S[1])
    c.rect(6, 18 + dy, 6, 27, S[2]); c.rect(17, 18 + dy, 17, 27, S[0])
    c.rect(11, 17 + dy, 12, 18 + dy, SK0)  # 목·옷깃
    c.rect(7, 28, 16, 30, PANTS)
    # 왼팔 (화면 왼쪽)
    if anim == 'wave':
        hand = [(1, 9), (4, 7), (1, 9)][f]
        c.line(5, 19 + dy, hand[0] + 1, hand[1] + 2, S[1], 2); c.rect(hand[0], hand[1], hand[0] + 1, hand[1] + 1, SK1)
    else:
        c.rect(4, 19 + dy, 5, 25, S[1]); c.rect(4, 25, 5, 26, SK1)
    # 오른팔 (잔)
    hand = None
    if anim == 'sip': hand = [(19, 24), (19, 19), (14, 13), (19, 19)][f]
    elif anim == 'cheers': hand = [(19, 19), (20, 9), (20, 4)][f]
    if hand:
        c.line(18, 19 + dy, hand[0], hand[1] + 1, S[1], 2); c.rect(hand[0], hand[1], hand[0] + 1, hand[1] + 1, SK1)
    else:
        c.rect(18, 19 + dy, 19, 25, S[1]); c.rect(18, 25, 19, 26, SK1)
    # 머리 (피부)
    y = dy
    c.rect(6, 4 + y, 17, 16 + y, SK1); c.rect(5, 6 + y, 18, 14 + y, SK1)
    c.rect(7, 16 + y, 16, 16 + y, SK0); c.rect(5, 6 + y, 5, 14 + y, SK0)
    c.rect(7, 5 + y, 9, 5 + y, SK2)
    hair_front(c, style, dy)
    # 얼굴
    closed = anim == 'sleep' or (anim == 'sip' and f == 2) or (anim == 'cheers' and f == 2)
    if closed:
        c.rect(7, 11 + y, 9, 11 + y, OUT); c.rect(14, 11 + y, 16, 11 + y, OUT)
    else:
        c.rect(8, 10 + y, 8, 11 + y, OUT); c.rect(15, 10 + y, 15, 11 + y, OUT)
        c.p(8, 10 + y, OUT); c.p(9, 10 + y, A3) if False else None
    c.p(7, 13 + y, BLUSH); c.p(16, 13 + y, BLUSH)
    if acc == 'beard':
        c.rect(6, 13 + y, 17, 16 + y, H[1]); c.rect(7, 17 + y, 16, 17 + y, H[1]); c.rect(10, 14 + y, 13, 14 + y, MOUTH)
    elif anim == 'talk' and f == 1:
        c.rect(11, 13 + y, 12, 14 + y, MOUTH)
    elif anim == 'sleep':
        c.p(12, 14 + y, MOUTH)
    else:
        c.p(10, 13 + y, OUT); c.rect(11, 14 + y, 12, 14 + y, OUT); c.p(13, 13 + y, OUT)
    if acc == 'glasses':
        for gx in (6, 13):
            c.rect(gx, 9 + y, gx + 4, 9 + y, OUT); c.rect(gx, 12 + y, gx + 4, 12 + y, OUT)
            c.rect(gx, 9 + y, gx, 12 + y, OUT); c.rect(gx + 4, 9 + y, gx + 4, 12 + y, OUT)
        c.p(11, 10 + y, OUT); c.p(12, 10 + y, OUT)
    if hand: glass_in_hand(c, hand[0] - 1 if anim == 'sip' and f == 2 else hand[0] + 1, hand[1] - 3)
    c.outline()
    return c.im

def draw_side(style, acc, anim, f):
    """오른쪽을 보는 옆모습 (왼쪽은 화면에서 좌우 반전)"""
    c = Canvas(24, 32)
    dy = bob(anim, f)
    y = dy
    if style == 'long': c.rect(5, 7 + y, 9, 20 + y, H[1])
    # 몸·다리 (앉은 자세: 허벅지가 앞으로)
    c.rect(8, 17 + y, 15, 27, S[1]); c.rect(8, 17 + y, 8, 27, S[0]); c.rect(15, 18 + y, 15, 27, S[2])
    c.rect(8, 27, 19, 29, PANTS); c.rect(17, 30, 19, 31, PANTS)
    c.rect(11, 16 + y, 13, 17 + y, SK0)
    # 머리
    c.rect(7, 4 + y, 17, 16 + y, SK1); c.rect(6, 6 + y, 18, 14 + y, SK1)
    c.rect(19, 11 + y, 19, 12 + y, SK1)                    # 코
    c.rect(7, 16 + y, 15, 16 + y, SK0); c.rect(10, 10 + y, 11, 12 + y, SK0)  # 턱·귀
    hair_side(c, style, dy)
    closed = anim == 'sleep' or (anim == 'sip' and f == 2) or (anim == 'cheers' and f == 2)
    if closed: c.rect(15, 11 + y, 16, 11 + y, OUT)
    else: c.rect(16, 10 + y, 16, 11 + y, OUT)
    c.p(17, 13 + y, BLUSH)
    if acc == 'beard':
        c.rect(12, 13 + y, 18, 16 + y, H[1]); c.p(18, 14 + y, MOUTH)
    elif anim == 'talk' and f == 1: c.rect(17, 14 + y, 18, 15 + y, MOUTH)
    elif anim != 'sleep': c.rect(17, 14 + y, 18, 14 + y, OUT)
    if acc == 'glasses':
        c.rect(14, 9 + y, 17, 9 + y, OUT); c.rect(14, 12 + y, 17, 12 + y, OUT); c.rect(14, 9 + y, 14, 12 + y, OUT); c.rect(17, 9 + y, 17, 12 + y, OUT)
        c.rect(11, 10 + y, 13, 10 + y, OUT)
    # 팔
    hand = {'sip': [(18, 23), (18, 19), (18, 14), (18, 19)], 'cheers': [(18, 19), (19, 10), (19, 4)],
            'wave': [(18, 9), (20, 6), (18, 9)]}.get(anim)
    hand = hand[f] if hand else (17, 23)
    c.line(11, 19 + y, hand[0], hand[1] + 1, S[2], 2); c.rect(hand[0], hand[1], hand[0] + 1, hand[1] + 1, SK1)
    if anim in ('sip', 'cheers'): glass_in_hand(c, hand[0] + (0 if anim == 'sip' and f == 2 else 1), hand[1] - 3)
    c.outline()
    return c.im

ANIMS = [('idle', 4), ('talk', 2), ('sip', 4), ('cheers', 3), ('sleep', 2), ('wave', 3)]

def char_sheet(cid, side):
    style, acc = STYLES[cid]
    sheet = Image.new('RGBA', (96, 192), T)
    for r, (name, n) in enumerate(ANIMS):
        for f in range(n):
            fr = (draw_side if side else draw_front)(style, acc, name, f)
            sheet.paste(fr, (f * 24, r * 32), fr)
    return sheet

# ── 소품 ───────────────────────────────────────────────

BOTTLES = [  # shared/catalog.ts 와 같은 순서 (shape, label color)
    ('tall', 'e09a3e'), ('square', '3b2418'), ('round', '7a2a2a'), ('square', 'a83a24'), ('tall', '35503f'), ('tall', '1f2e2a'),
    ('flask', 'f4c86a'), ('round', 'b5651d'), ('flask', 'a9c6c9'), ('round', 'a83a4c'), ('tall', '6b3f24'), ('square', '2e3d6a'),
]

def bottle(shape, label):
    c = Canvas(8, 16); L = hx(label); body = hx('8a4a1a'); hi = A2
    if shape == 'tall':
        c.rect(3, 1, 4, 5, body); c.rect(2, 6, 5, 14, body); c.rect(3, 0, 4, 0, RED)
    elif shape == 'square':
        c.rect(3, 2, 4, 5, body); c.rect(1, 6, 6, 14, body); c.rect(3, 1, 4, 1, OUT)
    elif shape == 'round':
        c.rect(3, 1, 4, 6, body); c.rect(2, 7, 5, 7, body); c.rect(1, 8, 6, 14, body); c.rect(3, 0, 4, 0, A1)
    else:  # flask
        c.rect(3, 2, 4, 6, body); c.rect(1, 7, 6, 14, body); c.rect(3, 1, 4, 1, GLS)
    c.rect(2, 9, 5, 12, L); c.rect(2, 9, 5, 9, A3)
    c.p(2 if shape != 'square' else 1, 7 if shape != 'tall' else 6, hi)
    return c.im  # 외곽선은 장면 위에서 너무 두꺼워서 생략

def glass(level):
    c = Canvas(8, 8)
    c.rect(1, 1, 6, 7, GLS); c.rect(2, 2, 5, 6, hx('d8eaec'))
    if level: c.rect(2, 7 - level, 5, 6, LIQ); c.rect(2, 7 - level, 5, 7 - level, A2)
    c.rect(1, 0, 6, 0, GLS); c.rect(1, 7, 6, 7, hx('7a9a9e')); c.p(1, 2, A3)
    return c.im

def jukebox(f):
    c = Canvas(32, 48)
    c.rect(2, 8, 29, 47, W1); c.rect(4, 2, 27, 8, W1); c.rect(8, 0, 23, 2, W1)
    c.rect(2, 8, 3, 47, W2); c.rect(28, 8, 29, 47, W0)
    glow = [A1, A2][f]; glow2 = [A2, A1][f]
    c.rect(6, 4, 25, 6, glow); c.rect(10, 1, 21, 2, glow2)
    c.rect(6, 12, 25, 24, G0); c.rect(8, 14, 23, 22, glow2)                # 곡 창
    for i in range(4): c.rect(9 + i * 4, 16, 10 + i * 4, 20, OUT)
    c.rect(6, 28, 25, 40, W0)                                               # 스피커
    for yy in range(29, 40, 2): c.rect(7, yy, 24, yy, W1)
    c.rect(4, 44, 27, 45, glow); c.outline()
    return c.im

def lamp(f):
    c = Canvas(16, 32); sx = [0, 1][f]
    c.rect(8, 0, 8, 18, OUT)
    c.rect(4 + sx, 18, 11 + sx, 21, W1); c.rect(3 + sx, 22, 12 + sx, 23, A0); c.rect(5 + sx, 24, 10 + sx, 25, A3)
    return c.im

def chair_front():
    c = Canvas(16, 32)
    c.rect(2, 2, 13, 20, RED); c.rect(3, 3, 12, 4, hx('a83a4c')); c.rect(2, 2, 2, 20, W1); c.rect(13, 2, 13, 20, W1)
    c.rect(2, 21, 13, 23, W1); c.rect(3, 24, 4, 31, W0); c.rect(11, 24, 12, 31, W0); c.outline()
    return c.im

def chair_side():
    c = Canvas(16, 32)
    c.rect(1, 2, 3, 22, W1); c.rect(1, 2, 1, 22, W2); c.rect(2, 4, 3, 16, RED)
    c.rect(1, 20, 14, 23, RED); c.rect(1, 23, 14, 23, W0); c.rect(2, 24, 3, 31, W0); c.rect(12, 24, 13, 31, W0); c.outline()
    return c.im

def table():
    """ㄷ자 테이블 144×80, 장면 (56,136)에 놓임. 윗면·앞면 두께 표현"""
    c = Canvas(144, 80)
    top = [(0, 0, 143, 15), (0, 0, 23, 63), (120, 0, 143, 63)]
    for x0, y0, x1, y1 in top: c.rect(x0, y0, x1, y1, W1)
    # 나뭇결
    for yy in (4, 10):
        c.rect(24, yy, 119, yy, W0)
    for xx in (8, 16): c.rect(xx, 18, xx, 60, W0)
    for xx in (128, 136): c.rect(xx, 18, xx, 60, W0)
    c.rect(0, 0, 143, 0, W2); c.rect(0, 0, 0, 63, W2); c.rect(120, 16, 120, 63, W2)
    # 앞면(두께)
    c.rect(24, 16, 119, 23, W0); c.rect(24, 16, 119, 16, OUT)
    c.rect(0, 64, 23, 71, W0); c.rect(120, 64, 143, 71, W0)
    c.rect(23, 16, 23, 63, OUT)
    # 다리
    for x in (2, 20, 122, 140): c.rect(x, 72, x + 1, 79, OUT)
    # 호박빛 반사
    c.rect(40, 2, 104, 2, A0); c.rect(4, 20, 4, 50, A0); c.rect(124, 20, 124, 50, A0)
    return c.im

def shelf():
    """술장 128×64: 2단 선반 + 12병"""
    c = Canvas(128, 64)
    c.rect(0, 0, 127, 63, W0); c.rect(2, 2, 125, 61, G0)
    for yy in (30, 58): c.rect(0, yy, 127, yy + 3, W1); c.rect(0, yy, 127, yy, W2)
    c.rect(0, 0, 127, 1, W2); c.rect(0, 0, 1, 63, W1); c.rect(126, 0, 127, 63, W1)
    # 뒷 조명
    for x in range(4, 124, 2): c.p(x, 3, A0)
    im = c.im
    for i, (shape, col) in enumerate(BOTTLES):
        b = bottle(shape, col)
        x = 12 + (i % 6) * 18; y = 10 + (i // 6) * 28 + 4
        im.paste(b, (x, y), b)
    return im

def bg_room():
    c = Canvas(256, 224)
    c.rect(0, 0, 255, 111, G1)
    for x in range(0, 256, 16): c.rect(x, 0, x, 79, G0)             # 벽지 줄
    c.rect(0, 80, 255, 111, W1)                                      # 징두리 판벽
    for x in range(0, 256, 32): c.rect(x, 84, x + 1, 108, W0)
    c.rect(0, 80, 255, 81, W2); c.rect(0, 110, 255, 111, OUT)
    # 바닥 (나무 판)
    for y in range(112, 224):
        band = (y - 112) // 8
        c.rect(0, y, 255, y, W0 if band % 2 else hx('4a2c1e'))
    for y in range(112, 224, 8):
        off = ((y - 112) // 8) * 37 % 64
        for x in range(off, 256, 64): c.rect(x, y, x, y + 7, OUT)
    # 창문 (왼쪽 벽, 비 오는 밤)
    c.rect(14, 14, 50, 66, W0); c.rect(16, 16, 48, 64, hx('1c2440'))
    for (x, y) in [(20, 22), (30, 40), (42, 26), (24, 52), (38, 58), (45, 46)]: c.rect(x, y, x, y + 3, hx('4a64a0'))
    c.rect(40, 20, 43, 23, A3); c.rect(31, 16, 33, 64, W0); c.rect(16, 39, 48, 41, W0)
    c.rect(12, 66, 52, 68, W1)
    # 호박빛 바닥 반사
    for x in range(60, 200, 3): c.p(x, 118, A0)
    return c.im

def effects():
    out = {}
    z = Canvas(16, 16); [z.rect(x, 3, x + 4, 3, A3) for x in (2,)]; z.rect(2, 3, 6, 3, A3); z.line(6, 4, 2, 8, A3); z.rect(2, 8, 6, 8, A3)
    z.rect(9, 9, 12, 9, A2); z.line(12, 10, 9, 12, A2); z.rect(9, 13, 12, 13, A2); out['fx_zzz'] = z.im
    s = Canvas(16, 16); s.rect(7, 1, 8, 14, A3); s.rect(1, 7, 14, 8, A3); s.rect(5, 5, 10, 10, A2); s.rect(7, 7, 8, 8, hx('ffffff')); out['fx_sparkle'] = s.im
    n = Canvas(16, 16); n.rect(9, 2, 10, 11, A3); n.rect(10, 2, 13, 3, A3); n.rect(5, 10, 9, 13, A3); out['fx_note'] = n.im
    t = Canvas(16, 16); t.rect(4, 0, 11, 0, A3); t.rect(5, 1, 10, 1, A3); t.rect(6, 2, 9, 2, A3); t.rect(7, 3, 8, 3, A3); out['fx_bubble_tail'] = t.im
    return out

def main():
    for cid in STYLES:
        char_sheet(cid, False).save(OUT_DIR / f'char_{cid:02d}_front.png')
        char_sheet(cid, True).save(OUT_DIR / f'char_{cid:02d}_side.png')
    for i, (shape, col) in enumerate(BOTTLES): bottle(shape, col).save(OUT_DIR / f'bottle_{i + 1:02d}.png')
    for lv in range(5): glass(lv).save(OUT_DIR / f'glass_level_{lv}.png')
    jb = Image.new('RGBA', (64, 48)); jb.paste(jukebox(0), (0, 0)); jb.paste(jukebox(1), (32, 0)); jb.save(OUT_DIR / 'furn_jukebox.png')
    lp = Image.new('RGBA', (32, 32)); lp.paste(lamp(0), (0, 0)); lp.paste(lamp(1), (16, 0)); lp.save(OUT_DIR / 'furn_lamp.png')
    chair_front().save(OUT_DIR / 'chair_front.png'); chair_side().save(OUT_DIR / 'chair_side.png')
    table().save(OUT_DIR / 'furn_table.png'); shelf().save(OUT_DIR / 'furn_shelf.png'); bg_room().save(OUT_DIR / 'bg_room.png')
    for k, im in effects().items(): im.save(OUT_DIR / f'{k}.png')
    print('assets:', len(list(OUT_DIR.glob('*.png'))), 'files ->', OUT_DIR)

if __name__ == '__main__':
    main()
