#!/usr/bin/env python3
"""
GPT 그림 → 게임용 진짜 도트 변환기 (규격서 1-6)

AI가 그린 '8배 크게 그린 도트 그림'은 픽셀 블록 크기가 들쭉날쭉하고, 경계가 번지고, 색이 수백 개로 늘어난다.
이 스크립트가 하는 일:
  1) 초록 배경(#00FF00) 제거 + 초록 번짐 제거
  2) 픽셀 블록 크기를 자동으로 찾아냄 (꼭 8이 아니어도 됨)
  3) 블록마다 가운데 색을 뽑아 1배 크기로 축소
  4) 규격 팔레트(최대 32색)로 색 맞춤
  5) 지정한 크기의 칸에 바닥 가운데 정렬로 배치 (캐릭터 24×32 등)

사용 예:
  python3 tools/convert.py gpt/char_01_front.png --size 24x32 -o assets/char_01_front.png
  python3 tools/convert.py gpt/sheet.png --frames 4x6 --size 24x32 -o assets/char_01_front.png
  python3 tools/convert.py gpt/bg.png --size 256x224 --align center -o assets/bg_room.png
  옵션: --palette extra.txt (GPT 제안 16색, 줄마다 #rrggbb) / --no-quantize / --block 8 (블록 크기 강제)
결과 옆에 _check.png (8배 확대 비교본)도 만든다.
"""
import argparse, math, sys
from pathlib import Path
import numpy as np
from PIL import Image

BASE_PALETTE = ['1a1210', '3b2418', '6b3f24', '9a6236', 'b5651d', 'e09a3e', 'f4c86a', 'fff1c4',
                'c8741f', 'a9c6c9', '1f2e2a', '35503f', '7a2a2a', 'b0705a', 'e0a585', 'f6d2b5']
# 색상 변형 키 색 (shared/layout.ts HAIR_RAMPS[0], SHIRT_RAMPS[0]) — 캐릭터 머리·옷은 이 색으로 맞춰야 변형이 된다
KEY_COLORS = ['241c1c', '3d2e2a', '5a4238', '1c2440', '2e3d6a', '4a64a0']

def hex2rgb(h): h = h.strip().lstrip('#'); return [int(h[i:i + 2], 16) for i in (0, 2, 4)]

def key_mask(rgb):
    """초록 배경과 초록 번짐 판정"""
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
    return (g > 120) & (g > r * 1.4 + 20) & (g > b * 1.4 + 20)

def block_candidates(img_rgb):
    """색이 바뀌는 위치들의 주기 점수(R)를 계산해 후보 블록 크기들을 돌려준다"""
    a = img_rgb.astype(int)
    dx = np.nonzero(np.abs(np.diff(a, axis=1)).sum(axis=2) > 60)[1] + 1
    dy = np.nonzero(np.abs(np.diff(a, axis=0)).sum(axis=2) > 60)[0] + 1
    pos = np.concatenate([dx, dy]).astype(float)
    if len(pos) < 20: return []
    if len(pos) > 200000: pos = np.random.default_rng(0).choice(pos, 200000, replace=False)
    ss = np.arange(3.0, 40.01, 0.05)
    R = np.array([abs(np.exp(2j * math.pi * pos / s).mean()) for s in ss])
    peaks = [i for i in range(1, len(ss) - 1) if R[i] >= R[i - 1] and R[i] >= R[i + 1] and R[i] >= 0.35 * R.max()]
    return [(float(ss[i]), float(R[i])) for i in peaks]

def recon_error(rgb, alpha, s):
    small = downsample(rgb, alpha, s, )
    if small.shape[0] < 2 or small.shape[1] < 2: return 1e9, small
    up = np.array(Image.fromarray(small).resize((round(small.shape[1] * s), round(small.shape[0] * s)), Image.NEAREST)).astype(int)
    # 위상 보정 없이 비교하면 손해 → 내용 영역만 비교
    h, w = min(up.shape[0], rgb.shape[0]), min(up.shape[1], rgb.shape[1])
    ys, xs = np.nonzero(alpha)
    y0, x0 = ys.min(), xs.min()
    sm = crop_to_content(small)
    up = np.array(Image.fromarray(sm).resize((round(sm.shape[1] * s), round(sm.shape[0] * s)), Image.NEAREST)).astype(int)
    src = rgb[y0:y0 + up.shape[0], x0:x0 + up.shape[1]].astype(int)
    al = alpha[y0:y0 + up.shape[0], x0:x0 + up.shape[1]]
    up = up[:src.shape[0], :src.shape[1]]
    err = (np.abs(src - up[..., :3]).sum(axis=2) * al).sum() / max(1, al.sum())
    return err, small

def find_block(rgb, alpha):
    """후보 블록 크기마다 '축소했다 다시 키웠을 때 원본과 얼마나 같은가'로 고른다.
    오차가 최소와 비슷한 후보 중 가장 큰 블록 = 진짜 픽셀 크기 (반·1/3 크기도 오차가 작기 때문)"""
    cands = block_candidates(np.where(alpha[..., None], rgb, 0))
    if not cands: return None, 0
    scored = []
    for s, R in sorted(cands, key=lambda c: -c[1])[:12]:
        e, _ = recon_error(rgb, alpha, s)
        scored.append((s, e, R))
    emin = min(e for _, e, _ in scored)
    ok = [(s, e, R) for s, e, R in scored if e <= emin * 1.25 + 4]
    s, e, R = max(ok)
    return s, R

def phase(pos_axis_changes, s):
    ang = 2 * math.pi * pos_axis_changes / s
    return (math.atan2(np.sin(ang).mean(), np.cos(ang).mean()) / (2 * math.pi) * s) % s

def downsample(rgb, alpha, s):
    a = rgb.astype(int)
    dx = np.nonzero(np.abs(np.diff(a, axis=1)).sum(axis=2) > 60)[1] + 1
    dy = np.nonzero(np.abs(np.diff(a, axis=0)).sum(axis=2) > 60)[0] + 1
    px = phase(dx.astype(float), s) if len(dx) else 0.0
    py = phase(dy.astype(float), s) if len(dy) else 0.0
    H, W = alpha.shape
    nx = int((W - px) // s); ny = int((H - py) // s)
    out = np.zeros((ny, nx, 4), np.uint8)
    m = max(1, int(s * 0.25))
    for j in range(ny):
        for i in range(nx):
            x0 = int(round(px + i * s)); y0 = int(round(py + j * s))
            x1 = int(round(px + (i + 1) * s)); y1 = int(round(py + (j + 1) * s))
            cx0, cx1, cy0, cy1 = x0 + m, max(x0 + m + 1, x1 - m), y0 + m, max(y0 + m + 1, y1 - m)
            al = alpha[cy0:cy1, cx0:cx1]
            if al.size == 0 or al.mean() < 0.5: continue
            block = rgb[cy0:cy1, cx0:cx1][al]
            out[j, i, :3] = np.median(block, axis=0)
            out[j, i, 3] = 255
    return out

def quantize(img, palette):
    pal = np.array(palette, float)
    op = img[..., 3] > 0
    px = img[..., :3][op].astype(float)
    # 사람 눈 기준 가중 거리
    w = np.array([0.30, 0.59, 0.11]) * 3
    d = (((px[:, None, :] - pal[None, :, :]) ** 2) * w).sum(axis=2)
    img = img.copy()
    img[..., :3][op] = pal[d.argmin(axis=1)].astype(np.uint8)
    return img

def crop_to_content(img):
    ys, xs = np.nonzero(img[..., 3])
    if not len(xs): return img
    return img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

def place(img, w, h, align):
    out = np.zeros((h, w, 4), np.uint8)
    ih, iw = img.shape[:2]
    if iw > w or ih > h:
        print(f'  ! 경고: 그림({iw}×{ih})이 칸({w}×{h})보다 큼 → 잘림. 원본 블록 크기나 여백을 확인하세요', file=sys.stderr)
        img = img[max(0, ih - h):, max(0, (iw - w) // 2):][:h, :w]; ih, iw = img.shape[:2]
    x = (w - iw) // 2
    y = h - ih if align == 'bottom' else (h - ih) // 2
    out[y:y + ih, x:x + iw] = img
    return out

def grid_cuts(op, ox, oy, fw, fh):
    """격자선이 그림을 가로지르는 횟수 (프레임 경계가 맞으면 0에 가깝다)"""
    H, W = op.shape; n = 0
    for x in range(ox % fw or fw, W, fw):
        if 0 < x < W: n += int((op[:, x - 1] & op[:, x]).sum())
    for y in range(oy % fh or fh, H, fh):
        if 0 < y < H: n += int((op[y - 1, :] & op[y, :]).sum())
    return n

def slice_sheet(small, cols, rows, fw, fh, align):
    """시트를 프레임으로 자른다. ① GPT가 격자를 지켰으면 격자 그대로 ② 아니면 빈 줄 기준으로 분리 후 바닥 정렬"""
    op = small[..., 3] > 0
    ys, xs = np.nonzero(op)
    best = min(((grid_cuts(op, ox, oy, fw, fh), ox, oy) for ox in range(fw) for oy in range(fh)))
    cuts, ox, oy = best
    if cuts <= 4:
        # 내용이 들어간 첫 칸부터 cols×rows 칸
        cx0 = (xs.min() - ox) // fw * fw + ox; cy0 = (ys.min() - oy) // fh * fh + oy
        out = np.zeros((rows * fh, cols * fw, 4), np.uint8)
        pad = np.zeros((small.shape[0] + rows * fh * 2, small.shape[1] + cols * fw * 2, 4), np.uint8)
        pad[rows * fh:rows * fh + small.shape[0], cols * fw:cols * fw + small.shape[1]] = small
        y0, x0 = cy0 + rows * fh, cx0 + cols * fw
        out[:] = pad[y0:y0 + rows * fh, x0:x0 + cols * fw]
        print(f'  격자 맞춤 성공 (경계 겹침 {cuts}px)')
        return out
    print(f'  ! 격자가 안 맞음 (경계 겹침 {cuts}px) → 빈 줄 기준으로 분리, 프레임별 바닥 정렬', file=sys.stderr)
    out = np.zeros((rows * fh, cols * fw, 4), np.uint8)
    def bands(mask_1d):
        segs, start = [], None
        for i, v in enumerate(list(mask_1d) + [False]):
            if v and start is None: start = i
            if not v and start is not None: segs.append((start, i)); start = None
        return segs
    rbands = bands(op.any(axis=1))
    if len(rbands) != rows: print(f'  ! 행 {len(rbands)}개 발견 (기대 {rows})', file=sys.stderr)
    for r, (y0, y1) in enumerate(rbands[:rows]):
        band = small[y0:y1]
        for c, (x0, x1) in enumerate(bands(band[..., 3].any(axis=0))[:cols]):
            out[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw] = place(crop_to_content(band[:, x0:x1]), fw, fh, align)
    return out

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('input'); ap.add_argument('-o', '--out', required=True)
    ap.add_argument('--size', required=True, help='칸 크기 WxH (예: 24x32)')
    ap.add_argument('--frames', help='시트일 때 열x행 (예: 4x6)')
    ap.add_argument('--align', choices=['bottom', 'center'], default='bottom')
    ap.add_argument('--palette', help='추가 색 파일 (#rrggbb 줄마다)')
    ap.add_argument('--no-quantize', action='store_true')
    ap.add_argument('--block', type=float, help='블록 크기 강제')
    a = ap.parse_args()

    fw, fh = map(int, a.size.lower().split('x'))
    src = Image.open(a.input).convert('RGBA')
    arr = np.array(src)
    rgb = arr[..., :3]
    alpha = (arr[..., 3] > 127) & ~key_mask(rgb)

    if a.block: s, conf = a.block, 1.0
    else: s, conf = find_block(rgb, alpha)
    if not s: sys.exit('블록 크기를 찾지 못했어요. --block 으로 지정해 주세요')
    small = downsample(rgb, alpha, s)
    print(f'블록 크기 {s:.2f}px (신뢰도 {conf:.2f}) → 축소 {small.shape[1]}×{small.shape[0]}')

    palette = [hex2rgb(h) for h in BASE_PALETTE + KEY_COLORS]
    if a.palette: palette += [hex2rgb(l) for l in Path(a.palette).read_text().split() if l.strip()]
    if not a.no_quantize: small = quantize(small, palette)

    if a.frames:
        cols, rows = map(int, a.frames.lower().split('x'))
        result = slice_sheet(small, cols, rows, fw, fh, a.align)
    elif small.shape[:2] == (fh, fw):
        result = small            # 이미 정확한 칸 크기로 그려옴 → 위치 그대로 유지
        print('  칸 크기와 정확히 일치 → 위치 보존')
    else:
        result = place(crop_to_content(small), fw, fh, a.align)

    used = len({tuple(p) for p in result[..., :3][result[..., 3] > 0]})
    Image.fromarray(result).save(a.out)
    big = Image.fromarray(result).resize((result.shape[1] * 8, result.shape[0] * 8), Image.NEAREST)
    chk = Image.new('RGBA', big.size, (53, 80, 63, 255)); chk.paste(big, (0, 0), big)
    chk.save(str(Path(a.out).with_suffix('')) + '_check.png')
    print(f'저장 {a.out} ({result.shape[1]}×{result.shape[0]}, {used}색)')

if __name__ == '__main__':
    main()
