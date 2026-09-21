#!/usr/bin/env python3
"""Rasterize the vault mark into PWA PNG icons without extra packages."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        round(a[0] + (b[0] - a[0]) * t),
        round(a[1] + (b[1] - a[1]) * t),
        round(a[2] + (b[2] - a[2]) * t),
    )


def rounded_rect_sdf(x: float, y: float, cx: float, cy: float, w: float, h: float, r: float) -> float:
    dx = abs(x - cx) - (w / 2 - r)
    dy = abs(y - cy) - (h / 2 - r)
    outside = math.hypot(max(dx, 0.0), max(dy, 0.0))
    inside = min(max(dx, dy), 0.0)
    return outside + inside - r


def write_png(path: Path, width: int, height: int, pixels: bytearray) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + pixels[y * width * 4 : (y + 1) * width * 4] for y in range(height))
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def paint_icon(size: int, *, maskable: bool = False) -> bytearray:
    pixels = bytearray(size * size * 4)
    bg = (7, 16, 13)
    card_back = (22, 53, 45)
    card_back_stroke = (58, 174, 148)
    card_front = (13, 29, 24)
    card_front_stroke = (101, 247, 213)
    line = (101, 247, 213)

    inset = 0.18 if maskable else 0.08
    origin = size * inset
    span = size * (1 - 2 * inset)
    radius = size * (0.18 if maskable else 0.16)

    back_cx, back_cy = origin + span * 0.56, origin + span * 0.48
    back_w, back_h = span * 0.52, span * 0.68
    front_cx, front_cy = origin + span * 0.46, origin + span * 0.52
    front_w, front_h = span * 0.52, span * 0.68
    card_r = span * 0.08

    for y in range(size):
        for x in range(size):
            px = x + 0.5
            py = y + 0.5
            tile = rounded_rect_sdf(px, py, size / 2, size / 2, size - 1, size - 1, radius)
            cover = clamp(0.65 - tile)
            color = bg
            alpha = cover

            back = rounded_rect_sdf(px, py, back_cx, back_cy, back_w, back_h, card_r)
            if back < 2.2:
                edge = clamp(1.4 - abs(back))
                fill = clamp(0.8 - back)
                color = mix(color, card_back, fill)
                color = mix(color, card_back_stroke, edge * 0.9)

            front = rounded_rect_sdf(px, py, front_cx, front_cy, front_w, front_h, card_r)
            if front < 2.4:
                edge = clamp(1.5 - abs(front))
                fill = clamp(0.85 - front)
                color = mix(color, card_front, fill)
                color = mix(color, card_front_stroke, edge)

            inner_left = front_cx - front_w * 0.28
            inner_right = front_cx + front_w * 0.22
            for index, ratio in enumerate((0.36, 0.50, 0.64)):
                line_y = origin + span * ratio
                if abs(py - line_y) < size * 0.018 and inner_left <= px <= (inner_right if index < 2 else inner_left + front_w * 0.28):
                    color = mix(color, line, 0.92)

            gem_x = front_cx + front_w * 0.22
            gem_y = front_cy + front_h * 0.28
            if math.hypot(px - gem_x, py - gem_y) < size * 0.028:
                color = mix(color, line, 0.95)

            i = (y * size + x) * 4
            pixels[i : i + 4] = bytes((*color, round(255 * alpha)))
    return pixels


def main() -> None:
    PUBLIC.mkdir(exist_ok=True)
    write_png(PUBLIC / "app-icon-192.png", 192, 192, paint_icon(192))
    write_png(PUBLIC / "app-icon-512.png", 512, 512, paint_icon(512))
    write_png(PUBLIC / "app-icon-512-maskable.png", 512, 512, paint_icon(512, maskable=True))
    write_png(PUBLIC / "apple-touch-icon.png", 180, 180, paint_icon(180))
    print("Wrote PWA icons to", PUBLIC)


if __name__ == "__main__":
    main()
