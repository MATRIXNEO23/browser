#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse

SIZES = [16, 22, 24, 32, 48, 64, 70, 128, 150, 256]

def make_icon(size: int, accent=(140, 184, 255, 255), private=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = max(1, round(size * 0.07))
    radius = max(3, round(size * 0.24))

    top = (31, 42, 54, 255) if not private else (25, 40, 43, 255)
    bottom = (10, 15, 21, 255) if not private else (8, 17, 19, 255)

    # simple deterministic vertical gradient
    for y in range(pad, size - pad):
        t = (y - pad) / max(1, size - 2 * pad - 1)
        color = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(4))
        d.line((pad, y, size - pad - 1, y), fill=color)

    # rounded clipping mask
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((pad, pad, size - pad - 1, size - pad - 1), radius=radius, fill=255)
    clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    clipped.paste(img, (0, 0), mask)
    img = clipped
    d = ImageDraw.Draw(img)

    border = max(1, round(size * 0.025))
    d.rounded_rectangle(
        (pad, pad, size - pad - 1, size - pad - 1),
        radius=radius,
        outline=(60, 77, 96, 255),
        width=border
    )

    # geometric B, readable even at 16 px
    left = round(size * 0.33)
    top_y = round(size * 0.23)
    bottom_y = round(size * 0.77)
    stem = max(2, round(size * 0.09))
    bar = max(2, round(size * 0.075))
    mid = round(size * 0.50)
    right = round(size * 0.68)

    d.rectangle((left, top_y, left + stem, bottom_y), fill=accent)
    d.rectangle((left, top_y, right - stem, top_y + bar), fill=accent)
    d.rectangle((left, mid - bar // 2, right - stem, mid + bar // 2), fill=accent)
    d.rectangle((left, bottom_y - bar, right - stem, bottom_y), fill=accent)

    d.arc((right - stem * 2, top_y, right + stem, mid + bar // 2), -90, 90, fill=accent, width=stem)
    d.arc((right - stem * 2, mid - bar // 2, right + stem, bottom_y), -90, 90, fill=accent, width=stem)

    return img

def save_assets(out: Path):
    out.mkdir(parents=True, exist_ok=True)

    standard = {size: make_icon(size) for size in SIZES}
    private = {size: make_icon(size, accent=(125, 228, 211, 255), private=True) for size in SIZES}

    for size in [16, 22, 24, 32, 48, 64, 128, 256]:
        standard[size].save(out / f"default{size}.png", optimize=True)

    standard[70].save(out / "VisualElements_70.png", optimize=True)
    standard[150].save(out / "VisualElements_150.png", optimize=True)
    private[70].save(out / "PrivateBrowsing_70.png", optimize=True)
    private[150].save(out / "PrivateBrowsing_150.png", optimize=True)

    ico_sizes = [(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)]
    base = standard[256]
    for name in ["firefox.ico", "firefox64.ico", "newtab.ico", "newwindow.ico"]:
        base.save(out / name, format="ICO", sizes=ico_sizes)

    private[256].save(out / "pbmode.ico", format="ICO", sizes=ico_sizes)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    save_assets(Path(args.output))
