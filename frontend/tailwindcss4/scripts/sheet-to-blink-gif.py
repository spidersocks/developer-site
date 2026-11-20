"""Slice a 3x3 blink sprite sheet into a 9-frame GIF with correlation-locked alignment."""
from pathlib import Path

import numpy as np
from PIL import Image

src = Path(
    r"C:\Users\26071164r\.cursor\projects\c-Users-26071164r-projects-developer-site"
    r"\assets\image-3643484c-672b-4120-a1eb-e3ce465eb0c4.jpg"
)
out = Path(
    r"C:\Users\26071164r\projects\developer-site\frontend\tailwindcss4\public\plaza"
    r"\sean-mii-blink.gif"
)
out.parent.mkdir(parents=True, exist_ok=True)

im = Image.open(src).convert("RGB")
W, H = im.size
cols, rows = 3, 3
cw, ch = W // cols, H // rows

cells = []
for r in range(rows):
    for c in range(cols):
        box = (c * cw, r * ch, c * cw + cw, r * ch + ch)
        cells.append(im.crop(box).copy())


def to_gray(img: Image.Image) -> np.ndarray:
    return np.asarray(img.convert("L"), dtype=np.float64)


def phase_shift(ref: np.ndarray, mov: np.ndarray) -> tuple[int, int]:
    """Integer (dx, dy) to translate `mov` so it lines up with `ref`."""
    F = np.fft.fft2(ref)
    G = np.fft.fft2(mov)
    R = F * np.conj(G)
    mag = np.abs(R)
    R = np.where(mag > 0, R / mag, 0)
    corr = np.fft.ifft2(R)
    peak = np.unravel_index(int(np.argmax(np.abs(corr))), corr.shape)
    dy, dx = int(peak[0]), int(peak[1])
    # Wrap to signed shifts in (-n/2, n/2]
    if dy > ch // 2:
        dy -= ch
    if dx > cw // 2:
        dx -= cw
    return dx, dy


ref_gray = to_gray(cells[0])
shifts = [(0, 0)]
for i in range(1, 9):
    dx, dy = phase_shift(ref_gray, to_gray(cells[i]))
    shifts.append((dx, dy))
    print(f"f{i}: shift to f0 = ({dx}, {dy})")

# Canvas large enough for every shifted cell
pad_x = max(abs(dx) for dx, dy in shifts) + 2
pad_y = max(abs(dy) for dx, dy in shifts) + 2
fw = cw + pad_x * 2
fh = ch + pad_y * 2
origin = (pad_x, pad_y)

aligned = []
for cell, (dx, dy) in zip(cells, shifts):
    canvas = Image.new("RGB", (fw, fh), (255, 255, 255))
    # Positive dx means mov must move right to match ref
    canvas.paste(cell, (origin[0] + dx, origin[1] + dy))
    aligned.append(canvas)

# Optional: crop shared non-white margins WITHOUT changing relative offsets
rgb0 = aligned[0]
px = rgb0.load()
minx, miny, maxx, maxy = fw, fh, 0, 0
for y in range(fh):
    for x in range(fw):
        p = px[x, y]
        if p[0] < 248 or p[1] < 248 or p[2] < 248:
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
pad = 4
crop = (
    max(0, minx - pad),
    max(0, miny - pad),
    min(fw, maxx + 1 + pad),
    min(fh, maxy + 1 + pad),
)
# Same crop box on every frame — alignment preserved
aligned = [frame.crop(crop) for frame in aligned]

palette_src = aligned[0].quantize(colors=256, method=Image.Quantize.MEDIANCUT)
gif_frames = [
    frame.quantize(palette=palette_src, dither=Image.Dither.NONE) for frame in aligned
]

durations = [
    2000,  # 0 open
    60,  # 1 half-close
    50,  # 2 closed
    50,  # 3 closed
    50,  # 4 closed
    50,  # 5 closed
    50,  # 6 closed
    60,  # 7 half-open
    2000,  # 8 open
]

gif_frames[0].save(
    out,
    save_all=True,
    append_images=gif_frames[1:],
    duration=durations,
    loop=0,
    optimize=False,
    disposal=2,
)

aside = src.parent / "sean-mii-blink.gif"
aside.write_bytes(out.read_bytes())

print(f"Wrote {out}")
print(f"Also {aside}")
print(f"Canvas: {aligned[0].size}, frames: {len(gif_frames)} (all 9)")
print(f"File size: {out.stat().st_size / 1024:.1f} KB")
