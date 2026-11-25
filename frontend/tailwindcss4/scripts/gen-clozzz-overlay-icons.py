"""Generate Clozzz overlay favicon/app icons from source art.

Usage:
  python scripts/gen-clozzz-overlay-icons.py path/to/source.png
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "clozzz"


def resize_crisp(im: Image.Image, size: int) -> Image.Image:
    """High-quality downscale; light unsharp for tiny favicons."""
    out = im.resize((size, size), Image.Resampling.LANCZOS)
    if size <= 32:
        out = out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=120, threshold=2))
    return out


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/gen-clozzz-overlay-icons.py path/to/source.png", file=sys.stderr)
        sys.exit(2)
    src_path = Path(sys.argv[1])
    if not src_path.is_file():
        print(f"Source not found: {src_path}", file=sys.stderr)
        sys.exit(1)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    img = Image.open(src_path).convert("RGBA")
    print("source:", img.size, img.mode)

    w, h = img.size
    if w != h:
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        img = img.crop((left, top, left + side, top + side))
        print("center-cropped to", img.size)

    sizes = {
        "favicon-16x16.png": 16,
        "favicon-32x32.png": 32,
        "apple-touch-icon.png": 180,
        "icon-192.png": 192,
        "icon-512.png": 512,
    }

    for name, size in sizes.items():
        resize_crisp(img, size).save(OUT_DIR / name, optimize=True)
        print("wrote", name, size)

    # Multi-size ICO from large source (PIL embeds listed sizes)
    img.save(OUT_DIR / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("wrote favicon.ico")


if __name__ == "__main__":
    main()
