from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1] / "public" / "icons"


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_color(a: tuple[int, int, int, int], b: tuple[int, int, int, int], t: float) -> tuple[int, int, int, int]:
    return tuple(int(lerp(a[i], b[i], t)) for i in range(4))


def blend(bottom: tuple[int, int, int, int], top: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    br, bg, bb, ba = bottom
    tr, tg, tb, ta = top
    alpha = ta / 255
    inv = 1 - alpha
    out_a = int((alpha + (ba / 255) * inv) * 255)
    if out_a <= 0:
        return (0, 0, 0, 0)
    return (
        int(tr * alpha + br * inv),
        int(tg * alpha + bg * inv),
        int(tb * alpha + bb * inv),
        out_a,
    )


class Canvas:
    def __init__(self, size: int):
        self.size = size
        self.pixels = [[(0, 0, 0, 0) for _ in range(size)] for _ in range(size)]

    def set(self, x: int, y: int, color: tuple[int, int, int, int]) -> None:
        if 0 <= x < self.size and 0 <= y < self.size:
            self.pixels[y][x] = blend(self.pixels[y][x], color)

    def fill_ellipse(self, cx: float, cy: float, rx: float, ry: float, color_fn) -> None:
        left = int(math.floor(cx - rx))
        right = int(math.ceil(cx + rx))
        top = int(math.floor(cy - ry))
        bottom = int(math.ceil(cy + ry))
        for y in range(top, bottom + 1):
            for x in range(left, right + 1):
                px = x + 0.5
                py = y + 0.5
                dx = (px - cx) / rx if rx else 0
                dy = (py - cy) / ry if ry else 0
                if dx * dx + dy * dy <= 1:
                    self.set(x, y, color_fn(px, py))

    def fill_polygon(self, points: list[tuple[float, float]], color_fn) -> None:
        min_x = int(math.floor(min(x for x, _ in points)))
        max_x = int(math.ceil(max(x for x, _ in points)))
        min_y = int(math.floor(min(y for _, y in points)))
        max_y = int(math.ceil(max(y for _, y in points)))
        edges = list(zip(points, points[1:] + points[:1]))
        for y in range(min_y, max_y + 1):
            for x in range(min_x, max_x + 1):
                px = x + 0.5
                py = y + 0.5
                inside = False
                for (x1, y1), (x2, y2) in edges:
                    if ((y1 > py) != (y2 > py)) and (px < (x2 - x1) * (py - y1) / ((y2 - y1) or 1e-9) + x1):
                        inside = not inside
                if inside:
                    self.set(x, y, color_fn(px, py))

    def stroke_ellipse(self, cx: float, cy: float, rx: float, ry: float, width: float, color) -> None:
        outer_rx = rx + width / 2
        outer_ry = ry + width / 2
        inner_rx = max(0.1, rx - width / 2)
        inner_ry = max(0.1, ry - width / 2)
        left = int(math.floor(cx - outer_rx))
        right = int(math.ceil(cx + outer_rx))
        top = int(math.floor(cy - outer_ry))
        bottom = int(math.ceil(cy + outer_ry))
        for y in range(top, bottom + 1):
            for x in range(left, right + 1):
                px = x + 0.5
                py = y + 0.5
                outer = ((px - cx) / outer_rx) ** 2 + ((py - cy) / outer_ry) ** 2 <= 1
                inner = ((px - cx) / inner_rx) ** 2 + ((py - cy) / inner_ry) ** 2 <= 1
                if outer and not inner:
                    self.set(x, y, color)

    def save_png(self, path: Path) -> None:
        raw = bytearray()
        for row in self.pixels:
            raw.append(0)
            for r, g, b, a in row:
                raw.extend((r, g, b, a))
        compressed = zlib.compress(bytes(raw), 9)

        def chunk(tag: bytes, data: bytes) -> bytes:
            crc = zlib.crc32(tag + data) & 0xFFFFFFFF
            return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

        png = bytearray(b"\x89PNG\r\n\x1a\n")
        png.extend(chunk(b"IHDR", struct.pack(">IIBBBBB", self.size, self.size, 8, 6, 0, 0, 0)))
        png.extend(chunk(b"IDAT", compressed))
        png.extend(chunk(b"IEND", b""))
        path.write_bytes(png)


def linear_gradient(x0: float, y0: float, x1: float, y1: float, start, end):
    dx = x1 - x0
    dy = y1 - y0
    denom = dx * dx + dy * dy or 1

    def color(px: float, py: float):
        t = ((px - x0) * dx + (py - y0) * dy) / denom
        return lerp_color(start, end, max(0.0, min(1.0, t)))

    return color


def render_icon(size: int) -> None:
    s = size / 128
    canvas = Canvas(size)

    dark = rgba("#1c1d1f")
    saucer = linear_gradient(22 * s, 88 * s, 104 * s, 108 * s, rgba("#9de300"), rgba("#5a9800"))
    cup = linear_gradient(34 * s, 26 * s, 94 * s, 96 * s, rgba("#ffffff"), rgba("#d5d9e2"))
    coffee = linear_gradient(38 * s, 28 * s, 88 * s, 48 * s, rgba("#4c1f08"), rgba("#8a4318"))
    crema = linear_gradient(48 * s, 34 * s, 80 * s, 44 * s, rgba("#b96c33"), rgba("#d78947"))

    canvas.fill_ellipse(64 * s, 98 * s, 48 * s, 16 * s, lambda *_: dark)
    canvas.fill_ellipse(64 * s, 94 * s, 44 * s, 13 * s, saucer)
    canvas.fill_ellipse(48 * s, 91 * s, 20 * s, 6 * s, lambda *_: rgba("#b8ef31", 210))

    canvas.fill_polygon(
        [(30 * s, 27 * s), (98 * s, 27 * s), (90 * s, 84 * s), (38 * s, 84 * s)],
        cup,
    )
    canvas.fill_ellipse(64 * s, 27 * s, 34 * s, 8 * s, lambda *_: dark)
    canvas.fill_ellipse(64 * s, 59 * s, 26 * s, 43 * s, cup)
    canvas.fill_ellipse(64 * s, 28 * s, 29 * s, 6 * s, lambda *_: rgba("#d6dae3"))
    canvas.fill_ellipse(64 * s, 29 * s, 27 * s, 5 * s, coffee)
    canvas.fill_ellipse(64 * s, 31 * s, 18 * s, 4 * s, crema)

    canvas.stroke_ellipse(95 * s, 57 * s, 22 * s, 23 * s, 4 * s, dark)
    canvas.stroke_ellipse(96 * s, 57 * s, 13 * s, 14 * s, 9 * s, rgba("#d7dbe3"))

    canvas.fill_ellipse(54 * s, 60 * s, 30 * s, 42 * s, lambda *_: rgba("#cfd4de", 120))
    canvas.fill_ellipse(47 * s, 55 * s, 15 * s, 27 * s, lambda *_: rgba("#ffffff", 235))

    canvas.save_png(ROOT / f"icon-{size}.png")


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        render_icon(size)


if __name__ == "__main__":
    main()
