#!/usr/bin/env python3
from pathlib import Path
import argparse

from PIL import Image

SIZES = [16, 22, 24, 32, 48, 64, 70, 128, 150, 256]


def render(source: Image.Image, size: int) -> Image.Image:
    return source.resize((size, size), Image.Resampling.LANCZOS)


def save_assets(source_path: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    source = Image.open(source_path).convert("RGBA")
    icons = {size: render(source, size) for size in SIZES}

    for size in [16, 22, 24, 32, 48, 64, 128, 256]:
        icons[size].save(out / f"default{size}.png", optimize=True)

    icons[70].save(out / "VisualElements_70.png", optimize=True)
    icons[150].save(out / "VisualElements_150.png", optimize=True)
    icons[70].save(out / "PrivateBrowsing_70.png", optimize=True)
    icons[150].save(out / "PrivateBrowsing_150.png", optimize=True)

    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    base = icons[256]

    for name in ["firefox.ico", "firefox64.ico", "newtab.ico", "newwindow.ico", "pbmode.ico"]:
        base.save(out / name, format="ICO", sizes=ico_sizes)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    save_assets(Path(args.source), Path(args.output))
