"""
Blink animation: locked transparent PNG base + eye ink swap only.

Do NOT paste a full face rectangle from the JPGs (that stamped mismatched
skin/shadows — the dark oval). Only replace eye/lid pixels onto Image 1.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ASSETS = Path(
    r"C:\Users\26071164r\.cursor\projects\c-Users-26071164r-projects-developer-site\assets"
)
OUT_DIR = Path(
    r"C:\Users\26071164r\projects\developer-site\frontend\tailwindcss4\public\plaza"
)

BASE_PATH = ASSETS / "image-7d0e77d4-aed0-4732-8afd-a775a56a45b4.png"
HALF_PATH = (
    ASSETS / "3b56bce0-467b-4a4f-8fe1-f504b084aa40-ceb2ff47-35cc-45f4-9f0b-bd07870a6770.jpg"
)
CLOSED_PATH = (
    ASSETS / "1701dc0a-1054-49c2-9e0b-0697bee90272-d5723921-4dbd-4282-8a8d-a8df492594cb.jpg"
)

OUT_STILL = OUT_DIR / "sean-mii.webp"
OUT_BLINK = OUT_DIR / "sean-mii-blink.webp"
OUT_STILL_ASIDE = ASSETS / "sean-mii.webp"
OUT_BLINK_ASIDE = ASSETS / "sean-mii-blink.webp"

# Short blink only (JS holds eyes-open for variable Mii-like gaps)
BLINK_MS = (30, 55, 30)  # half → closed → half (snappier)
BLINK_TOTAL_MS = sum(BLINK_MS)

# Around both eyes (search window for ink pixels — wide enough not to clip lids)
EYE_BOX = (275, 185, 510, 265)


def to_gray(img: Image.Image) -> np.ndarray:
    return np.asarray(img.convert("L"), dtype=np.float64)


def phase_shift(ref: np.ndarray, mov: np.ndarray) -> tuple[int, int]:
    h, w = ref.shape
    F = np.fft.fft2(ref)
    G = np.fft.fft2(mov)
    R = F * np.conj(G)
    mag = np.abs(R)
    R = np.where(mag > 0, R / mag, 0)
    corr = np.fft.ifft2(R)
    peak = np.unravel_index(int(np.argmax(np.abs(corr))), corr.shape)
    dy, dx = int(peak[0]), int(peak[1])
    if dy > h // 2:
        dy -= h
    if dx > w // 2:
        dx -= w
    return dx, dy


def on_white(rgba: Image.Image) -> Image.Image:
    bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    return Image.alpha_composite(bg, rgba).convert("RGB")


def align_to_base(base_rgba: Image.Image, other_rgb: Image.Image) -> Image.Image:
    ref = to_gray(on_white(base_rgba))
    if other_rgb.size != base_rgba.size:
        other_rgb = other_rgb.resize(base_rgba.size, Image.Resampling.LANCZOS)
    mov = to_gray(other_rgb)
    dx, dy = phase_shift(ref, mov)
    print(f"  align shift: ({dx}, {dy})")
    canvas = Image.new("RGB", base_rgba.size, (255, 255, 255))
    canvas.paste(other_rgb, (dx, dy))
    return canvas


def dilate(mask: np.ndarray, radius: int = 2) -> np.ndarray:
    img = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
    # MaxFilter size must be odd
    size = radius * 2 + 1
    img = img.filter(ImageFilter.MaxFilter(size=size))
    return np.asarray(img) > 127


def content_box(im: Image.Image, alpha_thr: int = 8, pad: int = 4) -> tuple[int, int, int, int]:
    """Tight bbox including soft shadow — matches the old plaza mii framing."""
    a = np.asarray(im.convert("RGBA"))[:, :, 3]
    ys, xs = np.where(a > alpha_thr)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    return (
        max(0, x0 - pad),
        max(0, y0 - pad),
        min(im.width, x1 + 1 + pad),
        min(im.height, y1 + 1 + pad),
    )


def composite_eye_ink(
    base: Image.Image,
    aligned_src: Image.Image,
    box: tuple[int, int, int, int],
) -> Image.Image:
    """
    Keep base skin/lighting. Only stamp dark eye/lid ink from the aligned
    source, and clear base open-eye ink in that window first.
    """
    out = np.asarray(base).copy()
    src = np.asarray(aligned_src.convert("RGBA"))

    L, T, R, B = box
    base_c = out[T:B, L:R]
    src_c = src[T:B, L:R]

    base_lum = base_c[:, :, :3].astype(np.float64).mean(axis=2)
    src_lum = src_c[:, :, :3].astype(np.float64).mean(axis=2)
    base_a = base_c[:, :, 3]

    # Near-black eye ink only — never pull soft AO shadows from the JPG.
    h = B - T
    below_brows = np.zeros_like(base_a, dtype=bool)
    below_brows[int(h * 0.20) :, :] = True
    opaque = (base_a > 200) & below_brows

    src_ink = (src_lum < 42) & opaque
    base_ink = (base_lum < 42) & opaque

    stamp = dilate(src_ink, radius=1)
    # Open pupils that the new lids don't cover → fill with SOURCE skin
    # (same photo as the lids), not a flat mean that makes pale blobs.
    cover = dilate(base_ink, radius=6) & (src_lum > 85) & opaque & ~stamp

    rgb = base_c[:, :, :3].copy()
    rgb[cover] = src_c[:, :, :3][cover]
    rgb[stamp] = src_c[:, :, :3][stamp]
    base_c[:, :, :3] = rgb
    out[T:B, L:R] = base_c
    return Image.fromarray(out, mode="RGBA")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading…")
    base = Image.open(BASE_PATH).convert("RGBA")
    half = Image.open(HALF_PATH).convert("RGB")
    closed = Image.open(CLOSED_PATH).convert("RGB")
    print(f"  eye window {EYE_BOX}")

    print("Aligning…")
    half_a = align_to_base(base, half)
    closed_a = align_to_base(base, closed)

    frame_open = base.copy()
    frame_half = composite_eye_ink(base, half_a, EYE_BOX)
    frame_closed = composite_eye_ink(base, closed_a, EYE_BOX)

    # Same tight crop on every frame so blink doesn't jitter and scale matches
    # the old plaza mii (body fills ~93% of the canvas, not ~64%).
    crop = content_box(frame_open)
    print(f"  tight crop {crop} → {crop[2] - crop[0]}x{crop[3] - crop[1]}")
    frame_open = frame_open.crop(crop)
    frame_half = frame_half.crop(crop)
    frame_closed = frame_closed.crop(crop)

    # Still: open eyes (site idle)
    print(f"Writing {OUT_STILL}…")
    frame_open.save(
        OUT_STILL,
        format="WEBP",
        lossless=True,
        exact=True,
        method=6,
        quality=100,
    )
    OUT_STILL_ASIDE.write_bytes(OUT_STILL.read_bytes())

    # One-shot blink clip — no long open hold (JS owns the gap)
    blink_frames = [frame_half, frame_closed, frame_half]
    print(f"Writing {OUT_BLINK} ({BLINK_TOTAL_MS}ms one-shot)…")
    blink_frames[0].save(
        OUT_BLINK,
        format="WEBP",
        save_all=True,
        append_images=blink_frames[1:],
        duration=list(BLINK_MS),
        loop=1,  # play through once when JS swaps it in
        lossless=True,
        exact=True,
        method=6,
        quality=100,
    )
    OUT_BLINK_ASIDE.write_bytes(OUT_BLINK.read_bytes())
    print(f"Still: {OUT_STILL.stat().st_size / 1024:.1f} KB {frame_open.size}")
    print(f"Blink: {OUT_BLINK.stat().st_size / 1024:.1f} KB")

if __name__ == "__main__":
    main()
