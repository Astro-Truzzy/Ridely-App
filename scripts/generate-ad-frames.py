#!/usr/bin/env python3
"""Render the five "book a delivery" frames for the Ridely video ad.

Every frame shares one composition so the five cut together as a sequence in the
edit: a ghost step numeral, a dotted route line, one step label, and a phone
showing the real booking screen. Screens reuse the app's palette and copy from
app/booking/* rather than inventing UI.

Run: python scripts/generate-ad-frames.py
"""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store" / "video-ad" / "frames"

# Shared palette, fonts and mask helpers live in the store-asset generator.
_spec = importlib.util.spec_from_file_location(
    "store_assets", Path(__file__).with_name("generate-store-assets.py")
)
assert _spec and _spec.loader
store = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(store)

BLUE = store.BLUE
GOLD = store.GOLD
GREEN = store.GREEN
WHITE = store.WHITE
OFF_WHITE = store.OFF_WHITE
INK = store.INK
MUTED = store.MUTED
BORDER = store.BORDER
_rounded_mask = store.rounded_mask

BLUE_TINT = (232, 238, 255)
NAVY = (11, 18, 48)
SLATE = (15, 23, 42)

W, H = 1080, 1920
S = 2  # supersample factor for the frame-level artwork

SCREEN_W, SCREEN_H = 900, 1480  # screen art space, matches the store assets
PHONE_SCREEN_W = 740  # screen width on the finished 1080x1920 frame

WEIGHTS = {"reg": store.f_reg, "semi": store.f_semi, "bold": store.f_bold}


def font(weight: str, size: int):
    return WEIGHTS[weight](size)


# --------------------------------------------------------------------------- #
# small drawing helpers
# --------------------------------------------------------------------------- #


def text(d: ImageDraw.ImageDraw, xy, s: str, size: int, weight="reg", fill=INK, spacing=8):
    d.multiline_text(xy, s, font=font(weight, size), fill=fill, spacing=spacing)


def tracked_text(d: ImageDraw.ImageDraw, xy, s: str, size: int, weight, fill, track: int):
    """Letter-spaced caps — used for the small eyebrow labels."""
    x, y = xy
    f = font(weight, size)
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill)
        x += f.getlength(ch) + track


def fit_size(s: str, max_w: int, start: int, smallest: int, weight="bold") -> int:
    size = start
    while size > smallest and font(weight, size).getlength(s) > max_w:
        size -= 2
    return size


def card(img: Image.Image, box, r=24, fill=WHITE, shadow=34, dy=10, blur=14):
    x0, y0, x1, y1 = (int(v) for v in box)
    if shadow:
        pad = blur * 2
        layer = Image.new("RGBA", (x1 - x0 + pad * 2, y1 - y0 + pad * 2), (0, 0, 0, 0))
        ImageDraw.Draw(layer).rounded_rectangle(
            (pad, pad + dy, pad + (x1 - x0), pad + dy + (y1 - y0)),
            r,
            fill=(SLATE[0], SLATE[1], SLATE[2], shadow),
        )
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
        img.alpha_composite(layer, (x0 - pad, y0 - pad))
    ImageDraw.Draw(img).rounded_rectangle((x0, y0, x1, y1), r, fill=fill)


def pill(d: ImageDraw.ImageDraw, box, s: str, size=16, weight="semi", fill=BLUE_TINT, color=BLUE, pad_x=18):
    x0, y0, x1, y1 = (int(v) for v in box)
    d.rounded_rectangle((x0, y0, x1, y1), (y1 - y0) // 2, fill=fill)
    d.text(((x0 + x1) / 2, (y0 + y1) / 2), s, font=font(weight, size), fill=color, anchor="mm")
    return (x0, y0, x1, y1)


def pill_for(d: ImageDraw.ImageDraw, xy, s: str, size=16, weight="semi", fill=BLUE_TINT, color=BLUE):
    x, y = xy
    tw = font(weight, size).getlength(s)
    hgt = size + 20
    return pill(d, (x, y, x + tw + 32, y + hgt), s, size, weight, fill, color)


def button(img: Image.Image, box, label: str, size=26, fill=BLUE, color=WHITE, r=22):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(tuple(int(v) for v in box), r, fill=fill)
    x0, y0, x1, y1 = box
    d.text(((x0 + x1) / 2, (y0 + y1) / 2), label, font=font("semi", size), fill=color, anchor="mm")


def tap_ring(img: Image.Image, box, r=26, color=BLUE, width=5, glow=70):
    """The consistent 'tap here' target that ties the five frames together."""
    x0, y0, x1, y1 = (int(v) for v in box)
    pad = 26
    layer = Image.new("RGBA", (x1 - x0 + pad * 2, y1 - y0 + pad * 2), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle((pad, pad, pad + (x1 - x0), pad + (y1 - y0)), r, outline=color + (glow,), width=width + 8)
    layer = layer.filter(ImageFilter.GaussianBlur(7))
    img.alpha_composite(layer, (x0 - pad, y0 - pad))
    ImageDraw.Draw(img).rounded_rectangle((x0, y0, x1, y1), r, outline=color + (255,), width=width)


def check(d: ImageDraw.ImageDraw, cx, cy, r=18, bg=BLUE, color=WHITE, width=6):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=bg)
    d.line((cx - r * 0.42, cy + r * 0.02, cx - r * 0.06, cy + r * 0.36), fill=color, width=width)
    d.line((cx - r * 0.06, cy + r * 0.36, cx + r * 0.48, cy - r * 0.34), fill=color, width=width)


def chevron(d: ImageDraw.ImageDraw, cx, cy, s=10, color=INK, width=4, right=True):
    sign = 1 if right else -1
    d.line((cx - sign * s, cy - s, cx + sign * s, cy), fill=color, width=width)
    d.line((cx + sign * s, cy, cx - sign * s, cy + s), fill=color, width=width)


def status_bar(d: ImageDraw.ImageDraw, w: int, color=INK) -> None:
    d.text((40, 30), "9:41", font=font("semi", 26), fill=color)
    d.text((w - 150, 34), "5G", font=font("semi", 20), fill=color)
    d.rounded_rectangle((w - 104, 32, w - 44, 56), 6, outline=color, width=3)
    d.rectangle((w - 100, 36, w - 66, 52), fill=color)
    d.rectangle((w - 42, 39, w - 38, 49), fill=color)


def nav_row(d: ImageDraw.ImageDraw, w: int, title: str, step: str | None = None):
    chevron(d, 56, 96, 12, INK, 5, right=False)
    text(d, (92, 72), title, 38, "bold", INK)
    if step:
        text(d, (w - 40 - font("semi", 22).getlength(step), 84), step, 22, "semi", MUTED)


# --------------------------------------------------------------------------- #
# icons
# --------------------------------------------------------------------------- #


def icon_box(d: ImageDraw.ImageDraw, cx, cy, s=40, color=WHITE, w=4):
    d.rounded_rectangle((cx - s / 2, cy - s * 0.30, cx + s / 2, cy + s * 0.44), 7, outline=color, width=w)
    d.line((cx - s / 2, cy - s * 0.06, cx + s / 2, cy - s * 0.06), fill=color, width=w)
    d.line((cx, cy - s * 0.30, cx, cy - s * 0.06), fill=color, width=w)


def icon_clock(d: ImageDraw.ImageDraw, cx, cy, s=40, color=WHITE, w=4):
    r = s * 0.42
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=color, width=w)
    d.line((cx, cy - r * 0.5, cx, cy), fill=color, width=w)
    d.line((cx, cy, cx + r * 0.45, cy + r * 0.22), fill=color, width=w)


def icon_star(d: ImageDraw.ImageDraw, cx, cy, s=40, color=WHITE):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        r = s * (0.44 if i % 2 == 0 else 0.18)
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    d.polygon(pts, fill=color)


def icon_chat(d: ImageDraw.ImageDraw, cx, cy, s=40, color=WHITE, w=4):
    d.rounded_rectangle((cx - s * 0.46, cy - s * 0.34, cx + s * 0.46, cy + s * 0.2), s * 0.16, outline=color, width=w)
    d.polygon([(cx - s * 0.16, cy + s * 0.2), (cx - s * 0.16, cy + s * 0.44), (cx + s * 0.12, cy + s * 0.2)], fill=color)


def icon_card(d: ImageDraw.ImageDraw, cx, cy, s=40, color=BLUE, w=4):
    d.rounded_rectangle((cx - s * 0.5, cy - s * 0.32, cx + s * 0.5, cy + s * 0.32), 7, outline=color, width=w)
    d.line((cx - s * 0.5, cy - s * 0.1, cx + s * 0.5, cy - s * 0.1), fill=color, width=w)


def icon_home(d: ImageDraw.ImageDraw, cx, cy, s=30, color=MUTED, w=4):
    d.line((cx - s * 0.42, cy, cx, cy - s * 0.36, cx + s * 0.42, cy), fill=color, width=w, joint="curve")
    d.line((cx - s * 0.32, cy, cx - s * 0.32, cy + s * 0.4, cx + s * 0.32, cy + s * 0.4, cx + s * 0.32, cy), fill=color, width=w, joint="curve")


def icon_list(d: ImageDraw.ImageDraw, cx, cy, s=30, color=MUTED, w=4):
    for i, dy in enumerate((-0.24, 0.12)):
        d.line((cx - s * 0.4, cy + s * dy, cx + s * 0.4, cy + s * dy), fill=color, width=w)
    d.ellipse((cx - s * 0.46, cy - s * 0.34, cx - s * 0.3, cy - s * 0.18), fill=color)


def icon_user(d: ImageDraw.ImageDraw, cx, cy, s=30, color=MUTED, w=4):
    d.ellipse((cx - s * 0.2, cy - s * 0.42, cx + s * 0.2, cy - s * 0.02), outline=color, width=w)
    d.arc((cx - s * 0.42, cy - s * 0.04, cx + s * 0.42, cy + s * 0.62), 200, 340, fill=color, width=w)


def icon_wallet(d: ImageDraw.ImageDraw, cx, cy, s=30, color=MUTED, w=4):
    d.rounded_rectangle((cx - s * 0.44, cy - s * 0.28, cx + s * 0.44, cy + s * 0.32), 7, outline=color, width=w)
    d.ellipse((cx + s * 0.12, cy - s * 0.06, cx + s * 0.28, cy + s * 0.1), fill=color)


def pin(d: ImageDraw.ImageDraw, cx, cy, color, r=16):
    d.ellipse((cx - r, cy - r * 2.1, cx + r, cy - r * 0.1), fill=color)
    d.polygon(
        [(cx - r * 0.64, cy - r * 1.05), (cx + r * 0.64, cy - r * 1.05), (cx, cy)],
        fill=color,
    )
    d.ellipse((cx - r * 0.38, cy - r * 1.74, cx + r * 0.38, cy - r * 0.98), fill=WHITE)


def rider_marker(img: Image.Image, cx, cy, r=26):
    glow = Image.new("RGBA", (img.width, img.height), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((cx - r * 2, cy - r * 2, cx + r * 2, cy + r * 2), fill=BLUE + (55,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(r)))
    d = ImageDraw.Draw(img)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=BLUE, outline=WHITE, width=6)
    d.polygon([(cx, cy - r * 0.55), (cx - r * 0.44, cy + r * 0.3), (cx + r * 0.44, cy + r * 0.3)], fill=WHITE)


# --------------------------------------------------------------------------- #
# map art — one city, shared by every frame that shows a map
# --------------------------------------------------------------------------- #

MAP_BG = (234, 239, 248)
MAP_BLOCK = (224, 232, 244)
MAP_PARK = (227, 238, 229)
MAP_ROAD = WHITE


def map_art(size, route=None, pins=(), rider=None, radius=0) -> Image.Image:
    w, h = size
    sc = max(0.34, min(w, h) / 900)  # strips reuse the same art at a smaller scale
    img = Image.new("RGBA", (w, h), MAP_BG + (255,))
    d = ImageDraw.Draw(img)

    block_r = max(2, int(18 * sc))
    d.rounded_rectangle((w * 0.03, h * 0.12, w * 0.34, h * 0.54), block_r, fill=MAP_PARK + (255,))
    d.rounded_rectangle((w * 0.66, h * 0.62, w * 0.97, h * 0.92), block_r, fill=MAP_BLOCK + (255,))
    d.rounded_rectangle((w * 0.08, h * 0.72, w * 0.46, h * 0.94), block_r, fill=MAP_BLOCK + (255,))

    for i in range(-2, 13):
        x = i * (w / 8)
        d.line((x, -h * 0.1, x + w * 0.22, h * 1.1), fill=MAP_ROAD + (255,), width=max(2, int(16 * sc)))
    for j in range(0, 10):
        y = j * (h / 8)
        d.line((-w * 0.1, y, w * 1.1, y - h * 0.04), fill=MAP_ROAD + (255,), width=max(2, int(13 * sc)))
    d.line((0, h * 0.78, w, h * 0.30), fill=MAP_ROAD + (255,), width=max(3, int(28 * sc)))
    d.line((w * 0.20, 0, w * 0.44, h), fill=MAP_ROAD + (255,), width=max(2, int(20 * sc)))

    if route:
        d.line(route, fill=BLUE + (70,), width=max(3, int(26 * sc)), joint="curve")
        d.line(route, fill=BLUE + (255,), width=max(2, int(10 * sc)), joint="curve")

    for cx, cy, color in pins:
        pin(d, cx, cy, color + (255,), r=max(5, 16 * sc))

    if rider:
        rider_marker(img, rider[0], rider[1], r=max(8, 26 * sc))

    if radius:
        img.putalpha(_rounded_mask((w, h), radius))
    return img


def map_strip(img: Image.Image, box, route=None, pins=(), rider=None, radius=20):
    w = int(box[2] - box[0])
    h = int(box[3] - box[1])
    art = map_art((w, h), route=route, pins=pins, rider=rider, radius=radius)
    img.alpha_composite(art, (int(box[0]), int(box[1])))


# --------------------------------------------------------------------------- #
# screens — drawn at 900x1480, copy taken from app/booking/*
# --------------------------------------------------------------------------- #


def screen_home() -> Image.Image:
    img = Image.new("RGBA", (SCREEN_W, SCREEN_H), OFF_WHITE + (255,))
    d = ImageDraw.Draw(img)
    status_bar(d, SCREEN_W)

    text(d, (40, 96), "Hello, Amaka", 42, "bold", INK)
    text(d, (40, 154), "Where would you like to send today?", 24, "reg", MUTED)
    d.ellipse((SCREEN_W - 116, 92, SCREEN_W - 40, 168), fill=BLUE + (255,))
    d.text((SCREEN_W - 78, 130), "A", font=font("bold", 32), fill=WHITE, anchor="mm")

    card(img, (40, 210, SCREEN_W - 40, 470), 26)
    map_strip(
        img,
        (54, 224, SCREEN_W - 54, 352),
        route=[(60, 108), (180, 96), (300, 82), (430, 70), (560, 58), (700, 64)],
        pins=[(700, 70, GREEN)],
        radius=18,
    )
    pill_for(d, (74, 246), "RIDER ON THE WAY", 16, "semi", WHITE, GREEN)
    d.text((74, 372), "Arriving in 12 mins", font=font("bold", 30), fill=INK)
    chevron(d, SCREEN_W - 68, 392, 10, BORDER, 4)
    text(d, (74, 414), "Victoria Island  →  Lekki Phase 1  ·  Chinedu", 20, "reg", MUTED)
    pill_for(d, (74, 448), "Handoff code 4821", 18, "semi", BLUE_TINT, BLUE)

    text(d, (40, 516), "Quick Actions", 30, "bold", INK)
    tiles = [
        ("Book Delivery", "Send a package", BLUE, icon_box),
        ("Schedule", "Plan ahead", GOLD, icon_clock),
        ("Favourites", "Saved places", GREEN, icon_star),
        ("Support", "Get help", (239, 68, 68), icon_chat),
    ]
    cw = (SCREEN_W - 80 - 20) // 2
    for i, (title, sub, color, glyph) in enumerate(tiles):
        col, row = i % 2, i // 2
        x = 40 + col * (cw + 20)
        y = 574 + row * 236
        card(img, (x, y, x + cw, y + 216), 24, shadow=26)
        d.ellipse((x + 24, y + 24, x + 24 + 88, y + 24 + 88), fill=color + (255,))
        glyph(d, x + 24 + 44, y + 24 + 46, 40, WHITE)
        d.text((x + 24, y + 132), title, font=font("semi", 25), fill=INK)
        d.text((x + 24, y + 168), sub, font=font("reg", 20), fill=MUTED)

    tap_ring(img, (40, 574, 40 + cw, 574 + 216), 24, BLUE, 5, 80)

    text(d, (40, 1072), "Recent Deliveries", 28, "bold", INK)
    card(img, (40, 1122, SCREEN_W - 40, 1250), 22, shadow=22)
    d.text((70, 1146), "Yesterday", font=font("reg", 18), fill=MUTED)
    d.text((70, 1176), "Yaba  →  Ikeja", font=font("semi", 24), fill=INK)
    d.text((SCREEN_W - 220, 1176), "₦2,400", font=font("bold", 24), fill=INK)
    d.text((70, 1214), "Delivered", font=font("reg", 18), fill=GREEN)

    # tab bar
    d.rectangle((0, 1290, SCREEN_W, SCREEN_H), fill=WHITE + (255,))
    d.line((0, 1290, SCREEN_W, 1290), fill=BORDER + (255,), width=2)
    tabs = [("Home", icon_home, BLUE), ("Bookings", icon_list, MUTED), ("Wallet", icon_wallet, MUTED), ("Profile", icon_user, MUTED)]
    for i, (label, glyph, color) in enumerate(tabs):
        cx = 112 + i * ((SCREEN_W - 224) // 3)
        glyph(d, cx, 1340, 34, color)
        d.text((cx, 1382), label, font=font("semi", 17), fill=color, anchor="ma")
    d.rounded_rectangle((0, 1466, SCREEN_W, SCREEN_H), 0, fill=WHITE + (255,))
    d.rounded_rectangle((SCREEN_W / 2 - 110, 1470, SCREEN_W / 2 + 110, 1480), 6, fill=(226, 230, 238, 255))
    return img


def screen_size() -> Image.Image:
    img = Image.new("RGBA", (SCREEN_W, SCREEN_H), OFF_WHITE + (255,))
    d = ImageDraw.Draw(img)
    status_bar(d, SCREEN_W)
    nav_row(d, SCREEN_W, "Parcel size", "1 of 3")
    text(d, (40, 158), "Choose a size for what you're sending.", 23, "reg", MUTED)

    sizes = [
        ("Small", "Documents, keys, small items", "Up to 20 × 15 × 5 cm", "Max 1 kg", False),
        ("Medium", "Clothing, books, electronics", "Up to 40 × 30 × 20 cm", "Max 5 kg", True),
        ("Large", "Large packages, multiple items", "Up to 60 × 45 × 40 cm", "Max 15 kg", False),
    ]
    for i, (title, desc, dims, weight, selected) in enumerate(sizes):
        y = 232 + i * 250
        card(img, (40, y, SCREEN_W - 40, y + 226), 26, fill=(BLUE_TINT if selected else WHITE))
        if selected:
            d.rounded_rectangle((40, y, SCREEN_W - 40, y + 226), 26, outline=BLUE + (255,), width=5)
        d.ellipse((70, y + 34, 70 + 86, y + 34 + 86), fill=BLUE_TINT + (255,) if not selected else WHITE + (255,))
        icon_box(d, 70 + 43, y + 34 + 46, 42, BLUE)
        d.text((182, y + 40), title, font=font("bold", 32), fill=BLUE if selected else INK)
        d.text((182, y + 84), desc, font=font("reg", 21), fill=MUTED)
        d.text((182, y + 126), dims, font=font("reg", 20), fill=MUTED)
        d.text((182, y + 166), weight, font=font("reg", 20), fill=MUTED)
        if selected:
            check(d, SCREEN_W - 92, y + 76, 20)

    pill_for(d, (40, 1050), "Estimated 25–35 mins", 19, "semi", WHITE, BLUE)
    d.text((286, 1058), "Price shown before you pay", font=font("reg", 21), fill=MUTED)

    button(img, (40, 1290, SCREEN_W - 40, 1400), "Continue", 27)
    tap_ring(img, (40, 1290, SCREEN_W - 40, 1400), 22, WHITE, 5, 110)
    d.rounded_rectangle((SCREEN_W / 2 - 110, 1470, SCREEN_W / 2 + 110, 1480), 6, fill=(226, 230, 238, 255))
    return img


def screen_address() -> Image.Image:
    img = Image.new("RGBA", (SCREEN_W, SCREEN_H), OFF_WHITE + (255,))
    d = ImageDraw.Draw(img)
    status_bar(d, SCREEN_W)
    nav_row(d, SCREEN_W, "Delivery details", "2 of 3")

    fields = [
        ("Pickup", "12 Admiralty Way, Lekki Phase 1", GREEN),
        ("Drop-off", "4 Ozumba Mbadiwe Ave, Victoria Island", BLUE),
    ]
    for i, (label, value, color) in enumerate(fields):
        y = 168 + i * 128
        card(img, (40, y, SCREEN_W - 40, y + 108), 22, shadow=24)
        d.ellipse((68, y + 40, 68 + 30, y + 70), fill=color + (255,))
        d.ellipse((78, y + 50, 88, y + 60), fill=WHITE + (255,))
        d.text((124, y + 24), label, font=font("semi", 17), fill=MUTED)
        d.text((124, y + 52), value, font=font("semi", 22), fill=INK)

    map_strip(
        img,
        (40, 440, SCREEN_W - 40, 930),
        route=[(120, 472), (210, 414), (262, 332), (330, 278), (420, 230), (520, 188), (612, 142), (700, 94)],
        pins=[(120, 474, GREEN), (700, 100, BLUE)],
        rider=(420, 234),
        radius=24,
    )
    pill_for(d, (70, 470), "4.8 km  ·  25–35 mins", 19, "semi", WHITE, INK)

    d.rounded_rectangle((40, 962, SCREEN_W - 40, 1036), 22, fill=(228, 233, 242, 255))
    d.rounded_rectangle((46, 968, 428, 1030), 18, fill=WHITE + (255,))
    d.text((237, 999), "Send now", font=font("semi", 21), fill=INK, anchor="mm")
    d.text((650, 999), "Schedule", font=font("semi", 21), fill=MUTED, anchor="mm")

    card(img, (40, 1064, SCREEN_W - 40, 1172), 22, shadow=22)
    d.ellipse((70, 1092, 70 + 52, 1092 + 52), fill=BLUE_TINT + (255,))
    icon_box(d, 70 + 26, 1092 + 26, 30, BLUE)
    d.text((144, 1088), "Medium parcel", font=font("semi", 24), fill=INK)
    d.text((144, 1124), "Up to 5 kg  ·  40 × 30 × 20 cm", font=font("reg", 20), fill=MUTED)
    d.text((SCREEN_W - 128, 1104), "Change", font=font("semi", 20), fill=BLUE)

    button(img, (40, 1290, SCREEN_W - 40, 1400), "Continue", 27)
    tap_ring(img, (40, 1290, SCREEN_W - 40, 1400), 22, WHITE, 5, 110)
    d.rounded_rectangle((SCREEN_W / 2 - 110, 1470, SCREEN_W / 2 + 110, 1480), 6, fill=(226, 230, 238, 255))
    return img


def screen_price() -> Image.Image:
    img = Image.new("RGBA", (SCREEN_W, SCREEN_H), OFF_WHITE + (255,))
    d = ImageDraw.Draw(img)
    status_bar(d, SCREEN_W)
    nav_row(d, SCREEN_W, "Price Estimate", "3 of 3")

    card(img, (40, 168, SCREEN_W - 40, 402), 26)
    d.text((72, 194), "Total cost", font=font("reg", 21), fill=MUTED)
    d.text((72, 224), "₦2,850", font=font("bold", 68), fill=INK)
    pill_for(d, (72, 322), "25–35 mins", 19, "semi", (226, 248, 238), GREEN)
    d.text((300, 330), "4.8 km  ·  Medium parcel", font=font("reg", 21), fill=MUTED)

    card(img, (40, 432, SCREEN_W - 40, 782), 26, shadow=26)
    rows = [("Base fare", "₦1,200"), ("Distance  ·  4.8 km", "₦1,400"), ("Medium parcel", "₦250")]
    y = 466
    for label, value in rows:
        d.text((72, y), label, font=font("reg", 22), fill=MUTED)
        d.text((SCREEN_W - 72 - font("semi", 22).getlength(value), y), value, font=font("semi", 22), fill=INK)
        y += 58
    d.line((72, 646, SCREEN_W - 72, 646), fill=BORDER + (255,), width=2)
    d.text((72, 676), "Total", font=font("bold", 26), fill=INK)
    total = "₦2,850"
    d.text((SCREEN_W - 72 - font("bold", 26).getlength(total), 676), total, font=font("bold", 26), fill=INK)

    card(img, (40, 812, SCREEN_W - 40, 936), 24, shadow=24)
    d.ellipse((70, 846, 70 + 56, 846 + 56), fill=BLUE_TINT + (255,))
    icon_card(d, 70 + 28, 846 + 28, 34, BLUE)
    d.text((146, 846), "Pay with card", font=font("semi", 24), fill=INK)
    d.text((146, 882), "•••• 4242", font=font("reg", 21), fill=MUTED)
    chevron(d, SCREEN_W - 76, 874, 10, BORDER, 4)

    # Payment rails the app actually supports: Paystack card, bank transfer, wallet.
    d.text((40, 976), "Change payment method", font=font("semi", 21), fill=MUTED)
    for i, method in enumerate(("Card", "Bank transfer", "Wallet")):
        x = 40 + i * 214
        d.rounded_rectangle((x, 1016, x + 196, 1084), 20, fill=WHITE + (255,))
        d.text((x + 98, 1050), method, font=font("semi", 20), fill=BLUE if i == 0 else MUTED, anchor="mm")

    button(img, (40, 1290, SCREEN_W - 40, 1400), "Confirm Booking", 27)
    tap_ring(img, (40, 1290, SCREEN_W - 40, 1400), 22, WHITE, 5, 110)
    d.text((SCREEN_W / 2, 1430), "Prices include VAT", font=font("reg", 19), fill=MUTED, anchor="ma")
    return img


def screen_tracking() -> Image.Image:
    img = map_art(
        (SCREEN_W, SCREEN_H),
        route=[(110, 902), (190, 806), (250, 706), (330, 606), (430, 524), (530, 444), (640, 372), (720, 300)],
        pins=[(110, 910, GREEN), (720, 306, BLUE)],
        rider=(430, 528),
    )
    d = ImageDraw.Draw(img)
    status_bar(d, SCREEN_W)

    d.rounded_rectangle((40, 150, 430, 234), 42, fill=WHITE + (250,))
    d.ellipse((68, 178, 92, 202), fill=GREEN + (255,))
    d.text((112, 176), "On the way  ·  12 min", font=font("semi", 24), fill=INK)

    sheet = Image.new("RGBA", (SCREEN_W, 560), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheet)
    sd.rounded_rectangle((0, 0, SCREEN_W - 1, 560), 38, fill=WHITE + (255,))
    sd.rounded_rectangle((SCREEN_W / 2 - 46, 16, SCREEN_W / 2 + 46, 28), 6, fill=BORDER + (255,))
    sd.text((40, 60), "Chinedu is 12 mins away", font=font("bold", 34), fill=INK)
    sd.text((40, 112), "Victoria Island  →  Lekki Phase 1", font=font("reg", 22), fill=MUTED)
    sd.rounded_rectangle((40, 168, SCREEN_W - 40, 264), 22, fill=BLUE_TINT + (255,))
    sd.text((72, 190), "HANDOFF CODE", font=font("semi", 17), fill=MUTED)
    sd.text((72, 214), "4 8 2 1", font=font("bold", 30), fill=BLUE)

    sd.rounded_rectangle((40, 300, 430, 404), 24, fill=BLUE + (255,))
    sd.text((235, 352), "Call rider", font=font("semi", 24), fill=WHITE, anchor="mm")
    sd.rounded_rectangle((450, 300, SCREEN_W - 40, 404), 24, fill=BLUE_TINT + (255,))
    sd.text(((450 + SCREEN_W - 40) / 2, 352), "Chat", font=font("semi", 24), fill=BLUE, anchor="mm")

    sd.text((40, 440), "Package  ·  Medium  ·  Paid with card", font=font("reg", 21), fill=MUTED)
    sd.rounded_rectangle((SCREEN_W / 2 - 110, 508, SCREEN_W / 2 + 110, 520), 6, fill=(226, 230, 238, 255))
    sheet = sheet.filter(ImageFilter.GaussianBlur(0))
    img.alpha_composite(sheet, (0, SCREEN_H - 560))
    return img


# --------------------------------------------------------------------------- #
# frame artwork
# --------------------------------------------------------------------------- #


def radial_bg(w: int, h: int) -> Image.Image:
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w * 0.5, h * 0.44
    dist = np.sqrt(((xx - cx) / (w * 0.80)) ** 2 + ((yy - cy) / (h * 0.64)) ** 2)
    t = np.clip(dist, 0.0, 1.0) ** 0.9

    base = np.array(BLUE, dtype=np.float32)
    edge = np.array(NAVY, dtype=np.float32)
    rgb = base[None, None, :] * (1 - t[..., None]) + edge[None, None, :] * t[..., None]

    bloom = np.clip(
        1
        - np.sqrt(
            ((xx - w * 0.06) / (w * 0.44)) ** 2 + ((yy - h * 0.94) / (h * 0.32)) ** 2
        ),
        0,
        1,
    ) ** 2 * 0.17
    rgb = rgb * (1 - bloom[..., None]) + np.array(GOLD, np.float32)[None, None, :] * bloom[..., None]

    grain = np.random.default_rng(7).normal(0, 2.2, (h, w, 1)).astype(np.float32)
    return Image.fromarray(np.clip(rgb + grain, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def road_pattern(w: int, h: int) -> Image.Image:
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(-2, 12):
        x = i * (w // 9)
        d.line((x, -h * 0.1, x + h * 0.33, h * 1.1), fill=(160, 190, 255, 34), width=4)
    for j in range(0, 14):
        y = j * (h // 11)
        d.line((-w * 0.1, y, w * 1.1, y - h * 0.06), fill=(160, 190, 255, 24), width=3)
    return layer.filter(ImageFilter.GaussianBlur(1.4))


def ghost_numeral(w: int, h: int, number: str) -> Image.Image:
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    size = int(h * 0.50)
    d.text(
        (w * 0.80, -h * 0.045),
        number,
        font=font("bold", size),
        fill=(255, 255, 255, 0),
        stroke_width=max(6, size // 95),
        stroke_fill=(255, 255, 255, 52),
        anchor="ma",
    )
    return layer


def dotted_route(w: int, h: int) -> Image.Image:
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    p = [(-0.06 * w, 0.87 * h), (0.28 * w, 0.74 * h), (0.62 * w, 0.36 * h), (1.06 * w, 0.13 * h)]

    pts = []
    for i in range(241):
        t = i / 240
        u = 1 - t
        x = u**3 * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t**3 * p[3][0]
        y = u**3 * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t**3 * p[3][1]
        pts.append((x, y))

    spacing = 30 * (w / 2160)
    travelled, next_dot = 0.0, 0.0
    for i in range(1, len(pts)):
        seg = math.dist(pts[i - 1], pts[i])
        travelled += seg
        if travelled >= next_dot:
            r = 5 * (w / 2160)
            cx, cy = pts[i]
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255, 105))
            next_dot = travelled + spacing
    return layer


def phone(canvas_w: int, screen: Image.Image) -> Image.Image:
    """Device art around an already-sized screen, incl. soft drop shadow."""
    sw, sh = screen.size
    bezel = 22 * S
    w, h = sw + bezel * 2, sh + bezel * 2
    device = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(device)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 152, fill=(12, 16, 24, 255))
    d.rounded_rectangle((3, 3, w - 4, h - 4), 149, outline=(62, 70, 88, 255), width=3)
    d.rounded_rectangle((bezel, bezel, w - bezel - 1, h - bezel - 1), 130, fill=(9, 12, 18, 255))
    device.paste(screen, (bezel, bezel), _rounded_mask(screen.size, 118))

    # screen glare
    glare = Image.new("RGBA", screen.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glare)
    gd.polygon(
        [(0, 0), (sw * 0.62, 0), (0, sh * 0.46)],
        fill=(255, 255, 255, 16),
    )
    glare = glare.filter(ImageFilter.GaussianBlur(30))
    glare.putalpha(Image.composite(glare.split()[-1], Image.new("L", screen.size, 0), _rounded_mask(screen.size, 118)))
    device.alpha_composite(glare, (bezel, bezel))

    # dynamic island
    d.rounded_rectangle((w / 2 - 132, bezel + 14, w / 2 + 132, bezel + 92), 40, fill=(9, 12, 18, 255))
    d.ellipse((w / 2 + 74, bezel + 40, w / 2 + 104, bezel + 70), fill=(30, 38, 52, 255))

    shadow = Image.new("RGBA", (w + 240, h + 240), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((120, 120 + 26, 120 + w, 120 + h + 26), 152, fill=(4, 8, 30, 150))
    return device, shadow.filter(ImageFilter.GaussianBlur(42))


def draw_progress(canvas, index: int):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = canvas.width / 2, 1794 * S
    spacing = 34 * S
    for i in range(5):
        x = cx + (i - 2) * spacing
        r = 7 * S
        alpha = 255 if i + 1 == index else (150 if i + 1 < index else 60)
        d.ellipse((x - r, cy - r, x + r, cy + r), fill=(255, 255, 255, alpha))
    canvas.alpha_composite(layer)


def draw_frame(number: str, label: str, index: int, screen_fn) -> Image.Image:
    cw, ch = W * S, H * S
    canvas = radial_bg(cw, ch)
    canvas.alpha_composite(road_pattern(cw, ch))
    canvas.alpha_composite(ghost_numeral(cw, ch, number))
    canvas.alpha_composite(dotted_route(cw, ch))

    screen = screen_fn().resize(
        (PHONE_SCREEN_W * S, int(round(PHONE_SCREEN_W * S * SCREEN_H / SCREEN_W))),
        Image.Resampling.LANCZOS,
    )
    device, shadow = phone(cw, screen)

    px = (cw - device.width) // 2
    py = 420 * S
    canvas.alpha_composite(shadow, (px - 120, py - 120))
    canvas.alpha_composite(device, (px, py))

    d = ImageDraw.Draw(canvas)
    x = 72 * S
    tracked_text(d, (x, 118 * S), f"STEP {index} OF 5", 24 * S, "semi", GOLD + (255,), 5 * S)

    size = fit_size(label, 930 * S, 88 * S, 52 * S)
    d.text((x, 158 * S), label, font=font("bold", size), fill=WHITE + (255,))

    # Ridely wordmark, held back so editor overlays can sit on top
    brand = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    mark_x, mark_y = 72 * S, 1762 * S
    store.draw_mark(brand, mark_x + 22 * S, mark_y, 44 * S, body=WHITE, accent=GOLD, cut=None)
    ImageDraw.Draw(brand).text(
        (mark_x + 62 * S, mark_y - 26 * S), "Ridely", font=font("bold", 40 * S), fill=WHITE
    )
    brand.putalpha(brand.getchannel("A").point(lambda a: a * 82 // 100))
    canvas.alpha_composite(brand)

    draw_progress(canvas, index)
    return canvas.resize((W, H), Image.Resampling.LANCZOS)


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #

FRAMES = [
    ("step-01-book-a-delivery.png", "1", "Book a delivery", 1, screen_home),
    ("step-02-pick-a-size.png", "2", "Pick a size", 2, screen_size),
    ("step-03-set-pickup-drop-off.png", "3", "Set pickup & drop-off", 3, screen_address),
    ("step-04-confirm-and-pay.png", "4", "Confirm & pay", 4, screen_price),
    ("step-05-track-live.png", "5", "Track live", 5, screen_tracking),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for filename, number, label, index, screen_fn in FRAMES:
        frame = draw_frame(number, label, index, screen_fn)
        path = OUT / filename
        frame.convert("RGB").save(path, "PNG", optimize=True)
        print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
