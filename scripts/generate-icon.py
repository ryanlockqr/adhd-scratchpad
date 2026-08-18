#!/usr/bin/env python3
"""Generate the 128x128 PNG required by VS Marketplace / Open VSX."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

WIDTH = 128
HEIGHT = 128


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def rounded_rect(x: int, y: int, w: int, h: int, r: int, px: int, py: int) -> bool:
    if px < x or py < y or px >= x + w or py >= y + h:
        return False
    if px < x + r and py < y + r:
        return (px - (x + r)) ** 2 + (py - (y + r)) ** 2 <= r * r
    if px >= x + w - r and py < y + r:
        return (px - (x + w - 1 - r)) ** 2 + (py - (y + r)) ** 2 <= r * r
    if px < x + r and py >= y + h - r:
        return (px - (x + r)) ** 2 + (py - (y + h - 1 - r)) ** 2 <= r * r
    if px >= x + w - r and py >= y + h - r:
        return (px - (x + w - 1 - r)) ** 2 + (py - (y + h - 1 - r)) ** 2 <= r * r
    return True


def pixel(px: int, py: int) -> bytes:
    # Charcoal field
    bg = (24, 26, 32)
    paper = (232, 234, 240)
    rule = (170, 176, 188)
    accent = (88, 196, 176)
    pin = (232, 196, 92)

    color = bg
    if rounded_rect(28, 18, 72, 92, 10, px, py):
        color = paper
        if px <= 34:
            color = accent
        elif 46 <= py <= 48 or 62 <= py <= 64 or 78 <= py <= 80:
            if 42 <= px <= 88:
                color = rule
    # Focus pin
    if (px - 96) ** 2 + (py - 30) ** 2 <= 64:
        color = pin

    return bytes((*color, 255))


def main() -> None:
    raw = bytearray()
    for y in range(HEIGHT):
        raw.append(0)
        for x in range(WIDTH):
            raw.extend(pixel(x, y))

    ihdr = struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    out = Path(__file__).resolve().parents[1] / "media" / "icon.png"
    out.write_bytes(png)
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
