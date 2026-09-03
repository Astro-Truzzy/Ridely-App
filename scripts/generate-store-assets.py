#!/usr/bin/env python3
"""Generate Ridely Play Store graphics and Expo icon assets."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
STORE = ROOT / "store" / "play"
GRAPHICS = STORE / "graphics"
PHONE_DIR = GRAPHICS / "screenshots" / "phone"
TABLET7_DIR = GRAPHICS / "screenshots" / "tablet-7"
TABLET10_DIR = GRAPHICS / "screenshots" / "tablet-10"
EXPO_IMAGES = ROOT / "assets" / "images"

BLUE = (23, 74, 255)
BLUE_DEEP = (14, 48, 196)
BLUE_SOFT = (47, 92, 255)
ICON_NAVY = (11, 16, 64)  # #0B1040 — rider icon background
GOLD = (255, 201, 71)
WHITE = (255, 255, 255)
OFF_WHITE = (247, 248, 250)
INK = (31, 41, 55)
MUTED = (107, 114, 128)
GREEN = (16, 185, 129)
CARD = (255, 255, 255)
BORDER = (229, 231, 235)

FONT_REG = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")
FONT_SEMI = Path(r"C:\Windows\Fonts\seguisb.ttf")


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def f_reg(size: int) -> ImageFont.FreeTypeFont:
    return font(FONT_REG if FONT_REG.exists() else FONT_BOLD, size)


def f_bold(size: int) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if FONT_BOLD.exists() else FONT_REG
    return font(path, size)


def f_semi(size: int) -> ImageFont.FreeTypeFont:
    path = FONT_SEMI if FONT_SEMI.exists() else FONT_BOLD
    return font(path, size)


def new_image(size: tuple[int, int], color=BLUE) -> Image.Image:
    return Image.new("RGBA", size, color + ((255,) if len(color) == 3 else ()))


def downscale(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    return img.resize(size, Image.Resampling.LANCZOS)


def flatten_on_blue(img: Image.Image) -> Image.Image:
    bg = Image.new("RGB", img.size, BLUE)
    if img.mode == "RGBA":
        bg.paste(img, mask=img.split()[-1])
    else:
        bg.paste(img.convert("RGB"))
    return bg


def save(img: Image.Image, path: Path, *, flatten: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = flatten_on_blue(img) if flatten else (img.convert("RGBA") if img.mode != "RGBA" else img)
    out.save(path, "PNG", optimize=True)
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return mask


def paste_round(base: Image.Image, overlay: Image.Image, xy: tuple[int, int], radius: int) -> None:
    mask = rounded_mask(overlay.size, radius)
    base.paste(overlay, xy, mask)


def draw_mark(
    canvas: Image.Image,
    cx: float,
    cy: float,
    unit: float,
    *,
    body: tuple[int, int, int] = WHITE,
    accent: tuple[int, int, int] = GOLD,
    cut: tuple[int, int, int] | None = BLUE,
    pin_only: bool = False,
) -> None:
    """Package + location pin. `unit` is overall mark height."""
    d = ImageDraw.Draw(canvas)
    pw, ph = unit * 0.70, unit * 0.52
    pkg_top = cy - ph * 0.18
    left = cx - pw / 2
    d.rounded_rectangle(
        [left, pkg_top, left + pw, pkg_top + ph],
        radius=unit * 0.10,
        fill=body,
    )
    tape_y = pkg_top + ph * 0.42
    tape_h = unit * 0.09
    d.rectangle([left, tape_y, left + pw, tape_y + tape_h], fill=accent)

    flap = unit * 0.12
    d.polygon(
        [
            (cx, pkg_top + flap * 0.2),
            (left + unit * 0.06, pkg_top),
            (left + pw - unit * 0.06, pkg_top),
        ],
        fill=body,
    )

    pr = unit * 0.22
    px, py = cx, pkg_top - pr * 0.55
    d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=accent)
    tip_h = unit * 0.20
    d.polygon(
        [
            (px - pr * 0.62, py + pr * 0.45),
            (px + pr * 0.62, py + pr * 0.45),
            (px, py + pr + tip_h),
        ],
        fill=accent,
    )
    ir = pr * 0.42
    hole = cut if cut is not None else body
    d.ellipse([px - ir, py - ir, px + ir, py + ir], fill=hole)

    if pin_only:
        return


def draw_wordmark(d: ImageDraw.ImageDraw, x: int, y: int, size: int, color=WHITE) -> None:
    d.text((x, y), "Ridely", font=f_bold(size), fill=color)


def make_rider_full_icon(size: int, fill: float = 0.70) -> Image.Image | None:
    """Composite the transparent rider foreground onto the navy full-bleed icon."""
    fg_path = EXPO_IMAGES / "adaptive-icon.png"
    if not fg_path.exists():
        return None
    fg = Image.open(fg_path).convert("RGBA")
    bbox = fg.getchannel("A").point(lambda p: 255 if p > 12 else 0).getbbox()
    if not bbox:
        return None
    subject = fg.crop(bbox)
    sw, sh = subject.size
    scale = (size * fill) / max(sw, sh)
    nw, nh = max(1, round(sw * scale)), max(1, round(sh * scale))
    subject = subject.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), ICON_NAVY + (255,))
    canvas.paste(subject, ((size - nw) // 2, (size - nh) // 2), subject)
    return canvas


def make_app_icon(size: int = 1024) -> Image.Image:
    rider = make_rider_full_icon(size)
    if rider is not None:
        return rider
    scale = 2
    img = new_image((size * scale, size * scale), BLUE)
    cx = cy = size * scale / 2
    draw_mark(img, cx, cy + size * scale * 0.02, size * scale * 0.58)
    return downscale(img, (size, size))


def make_adaptive_foreground(size: int = 1024) -> Image.Image:
    scale = 2
    img = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
    cx = cy = size * scale / 2
    # Adaptive safe zone is the inner 66%. Keep the mark inside ~58%.
    draw_mark(img, cx, cy + size * scale * 0.02, size * scale * 0.52)
    return downscale(img, (size, size))


def make_splash_icon(size: int = 1024) -> Image.Image:
    return make_adaptive_foreground(size)


def make_notification_icon(size: int = 96) -> Image.Image:
    scale = 8
    img = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
    cx = cy = size * scale / 2
    draw_mark(
        img,
        cx,
        cy + size * scale * 0.04,
        size * scale * 0.78,
        body=WHITE,
        accent=WHITE,
        cut=(0, 0, 0, 0),
    )
    # Punch a transparent hole in the pin so Android can tint a true silhouette.
    d = ImageDraw.Draw(img)
    pr = size * scale * 0.78 * 0.22
    px, py = cx, (cy + size * scale * 0.04) - (size * scale * 0.78 * 0.52 * 0.18) - pr * 0.55
    # Recompute hole using same geometry as draw_mark
    pkg_top = (cy + size * scale * 0.04) - (size * scale * 0.78 * 0.52) * 0.18
    px, py = cx, pkg_top - pr * 0.55
    ir = pr * 0.42
    d.ellipse([px - ir, py - ir, px + ir, py + ir], fill=(0, 0, 0, 0))
    return downscale(img, (size, size))


def make_favicon(size: int = 192) -> Image.Image:
    return make_app_icon(size)


def _blend(fg: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(BLUE[i] * (1 - t) + fg[i] * t) for i in range(3))  # type: ignore[return-value]


def circles(img: Image.Image) -> None:
    d = ImageDraw.Draw(img)
    w, h = img.size
    d.ellipse([-h * 0.35, -h * 0.55, h * 0.55, h * 0.35], fill=_blend(BLUE_SOFT, 0.55))
    d.ellipse([w * 0.62, h * 0.35, w * 1.18, h * 1.35], fill=_blend(GOLD, 0.22))
    d.ellipse([w * 0.72, -h * 0.25, w * 1.05, h * 0.28], fill=_blend(WHITE, 0.16))


def make_feature_graphic() -> Image.Image:
    w, h = 2048, 1000
    img = new_image((w, h), BLUE)
    circles(img)
    d = ImageDraw.Draw(img)
    draw_mark(img, 280, 500, 340)
    d.text((520, 310), "Ridely", font=f_bold(132), fill=WHITE)
    d.text((524, 470), "Deliveries, made simple", font=f_semi(52), fill=GOLD)
    d.text(
        (524, 560),
        "Book a package. Track live. Pay securely.\nOr hop on as a rider and earn.",
        font=f_reg(36),
        fill=(255, 255, 255, 230),
        spacing=10,
    )
    # Mini route card
    card = Image.new("RGBA", (560, 620), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((0, 0, 559, 619), 48, fill=WHITE)
    cd.rounded_rectangle((28, 28, 531, 300), 28, fill=(232, 238, 255))
    # route
    cd.line([(90, 250), (180, 140), (300, 190), (430, 80)], fill=BLUE, width=10)
    cd.ellipse((70, 230, 110, 270), fill=GREEN)
    cd.ellipse((410, 60, 450, 100), fill=GOLD)
    cd.text((44, 340), "Lagos Island  →  Ikeja", font=f_semi(28), fill=INK)
    cd.text((44, 390), "Rider on the way  ·  12 min", font=f_reg(24), fill=MUTED)
    cd.rounded_rectangle((44, 460, 516, 560), 22, fill=BLUE)
    cd.text((118, 488), "Track live delivery", font=f_semi(28), fill=WHITE)
    img.paste(card, (1380, 190), card)
    return downscale(img, (1024, 500))


def draw_status_bar(d: ImageDraw.ImageDraw, w: int, y: int = 18) -> None:
    d.text((28, y), "9:41", font=f_semi(22), fill=INK)
    d.text((w - 118, y), "5G  100%", font=f_reg(18), fill=MUTED)


def phone_chrome(width: int, height: int) -> Image.Image:
    phone = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(phone)
    d.rounded_rectangle((0, 0, width - 1, height - 1), 56, fill=(15, 23, 42))
    d.rounded_rectangle((10, 10, width - 11, height - 11), 48, fill=OFF_WHITE)
    # speaker
    d.rounded_rectangle((width / 2 - 52, 22, width / 2 + 52, 38), 8, fill=(15, 23, 42))
    return phone


def screenshot_canvas(w: int, h: int, headline: str, sub: str) -> Image.Image:
    img = new_image((w, h), BLUE)
    circles(img)
    d = ImageDraw.Draw(img)
    d.text((72, 88), headline, font=f_bold(72), fill=WHITE)
    d.text((72, 280), sub, font=f_reg(34), fill=(255, 255, 255, 230), spacing=8)
    return img


def place_phone(base: Image.Image, screen: Image.Image, top: int) -> None:
    pw, ph = screen.size
    chrome_w, chrome_h = pw + 20, ph + 70
    chrome = phone_chrome(chrome_w, chrome_h)
    x = (base.width - chrome_w) // 2
    shadow = Image.new("RGBA", (chrome_w + 40, chrome_h + 40), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((10, 18, chrome_w + 20, chrome_h + 28), 60, fill=(0, 0, 0, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    base.paste(shadow, (x - 20, top - 10), shadow)
    chrome.paste(screen, (10, 48), screen if screen.mode == "RGBA" else None)
    if screen.mode != "RGBA":
        mask = rounded_mask(screen.size, 36)
        chrome.paste(screen, (10, 48), mask)
    else:
        mask = rounded_mask(screen.size, 36)
        chrome.paste(screen.convert("RGBA"), (10, 48), mask)
    base.paste(chrome, (x, top), chrome)


def screen_home() -> Image.Image:
    w, h = 900, 1480
    img = new_image((w, h), OFF_WHITE)
    d = ImageDraw.Draw(img)
    draw_status_bar(d, w, 28)
    d.text((40, 90), "Good afternoon,", font=f_reg(28), fill=MUTED)
    d.text((40, 132), "Adaeze", font=f_bold(44), fill=INK)
    d.ellipse((w - 108, 110, w - 44, 174), fill=BLUE)
    d.text((w - 90, 124), "A", font=f_bold(28), fill=WHITE)

    d.rounded_rectangle((40, 210, w - 40, 430), 28, fill=WHITE)
    d.rounded_rectangle((56, 226, 210, 266), 12, fill=GREEN)
    d.text((70, 232), "IN TRANSIT", font=f_semi(16), fill=WHITE)
    d.text((w - 200, 230), "12 mins", font=f_semi(22), fill=BLUE)
    d.text((56, 290), "Rider: Chinedu", font=f_semi(28), fill=INK)
    d.text((56, 338), "Lekki Phase 1  →  Victoria Island", font=f_reg(22), fill=MUTED)
    d.text((56, 380), "Tap to track live  →", font=f_semi(22), fill=BLUE)

    d.text((40, 470), "Quick Actions", font=f_bold(30), fill=INK)
    actions = [
        ("Book", "Send a package", BLUE),
        ("Schedule", "Plan ahead", GOLD),
        ("Favorites", "Saved places", GREEN),
        ("Support", "Get help", (239, 68, 68)),
    ]
    gap, card_w, card_h = 20, (w - 80 - 20) // 2, 170
    for i, (title, sub, color) in enumerate(actions):
        col, row = i % 2, i // 2
        x = 40 + col * (card_w + gap)
        y = 520 + row * (card_h + gap)
        d.rounded_rectangle((x, y, x + card_w, y + card_h), 24, fill=WHITE)
        d.rounded_rectangle((x + 22, y + 22, x + 78, y + 78), 16, fill=color)
        d.text((x + 22, y + 96), title, font=f_semi(24), fill=INK)
        d.text((x + 22, y + 128), sub, font=f_reg(18), fill=MUTED)

    d.text((40, 900), "Recent Deliveries", font=f_bold(30), fill=INK)
    d.rounded_rectangle((40, 950, w - 40, 1088), 22, fill=WHITE)
    d.text((64, 972), "Yesterday", font=f_reg(18), fill=MUTED)
    d.text((64, 1004), "Yaba  →  Ikeja", font=f_semi(24), fill=INK)
    d.text((w - 200, 1004), "₦2,400", font=f_bold(24), fill=INK)
    d.text((64, 1042), "Delivered", font=f_reg(18), fill=GREEN)
    return img


def screen_tracking() -> Image.Image:
    w, h = 900, 1480
    img = new_image((w, h), (226, 234, 252))
    d = ImageDraw.Draw(img)
    # faux map
    d.line([(80, 1180), (180, 860), (340, 720), (520, 480), (700, 360)], fill=BLUE, width=14)
    d.ellipse((64, 1164, 112, 1212), fill=GREEN)
    d.ellipse((676, 336, 740, 400), fill=GOLD)
    d.ellipse((500, 452, 560, 512), fill=BLUE)
    d.polygon([(530, 420), (548, 452), (512, 452)], fill=BLUE)
    d.text((40, 40), "Live tracking", font=f_bold(36), fill=INK)

    sheet = Image.new("RGBA", (w, 420), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheet)
    sd.rounded_rectangle((0, 0, w - 1, 419), 36, fill=WHITE)
    sd.rounded_rectangle((w / 2 - 40, 16, w / 2 + 40, 28), 6, fill=BORDER)
    sd.rounded_rectangle((36, 56, 200, 100), 14, fill=GREEN)
    sd.text((52, 64), "NEARBY", font=f_semi(18), fill=WHITE)
    sd.text((36, 124), "Chinedu is 4 mins away", font=f_bold(32), fill=INK)
    sd.text((36, 176), "Handoff code  ·  4821", font=f_semi(24), fill=BLUE)
    sd.rounded_rectangle((36, 240, 250, 330), 22, fill=BLUE)
    sd.text((70, 266), "Call rider", font=f_semi(24), fill=WHITE)
    sd.rounded_rectangle((270, 240, 500, 330), 22, fill=(232, 238, 255))
    sd.text((310, 266), "Chat", font=f_semi(24), fill=BLUE)
    img.paste(sheet, (0, h - 420), sheet)
    return img


def screen_pay() -> Image.Image:
    w, h = 900, 1480
    img = new_image((w, h), OFF_WHITE)
    d = ImageDraw.Draw(img)
    draw_status_bar(d, w, 28)
    d.text((40, 100), "Payment", font=f_bold(40), fill=INK)
    d.text((40, 160), "Delivery total", font=f_reg(22), fill=MUTED)
    d.text((40, 196), "₦3,150.00", font=f_bold(52), fill=INK)

    methods = [
        ("Card  ·  Visa •• 4242", "Pay with Paystack", True),
        ("Cash on delivery", "Pay the rider in cash", False),
        ("Wallet", "Coming soon", False),
    ]
    y = 300
    for title, sub, selected in methods:
        d.rounded_rectangle((40, y, w - 40, y + 130), 24, fill=WHITE)
        if selected:
            d.rounded_rectangle((40, y, w - 40, y + 130), 24, outline=BLUE, width=4)
        d.ellipse((64, y + 44, 112, y + 92), fill=BLUE if selected else BORDER)
        d.text((140, y + 32), title, font=f_semi(26), fill=INK)
        d.text((140, y + 72), sub, font=f_reg(20), fill=MUTED)
        y += 150

    d.rounded_rectangle((40, 1280, w - 40, 1400), 28, fill=BLUE)
    d.text((280, 1318), "Pay  ₦3,150", font=f_bold(30), fill=WHITE)
    return img


def screen_rider() -> Image.Image:
    w, h = 900, 1480
    img = new_image((w, h), OFF_WHITE)
    d = ImageDraw.Draw(img)
    draw_status_bar(d, w, 28)
    d.text((40, 100), "Today's earnings", font=f_reg(22), fill=MUTED)
    d.text((40, 138), "₦18,450", font=f_bold(56), fill=INK)
    d.text((40, 214), "7 deliveries  ·  Online", font=f_semi(22), fill=GREEN)

    d.rounded_rectangle((40, 280, w - 40, 520), 28, fill=WHITE)
    d.rounded_rectangle((56, 300, 220, 344), 12, fill=GOLD)
    d.text((72, 308), "NEW JOB", font=f_semi(16), fill=INK)
    d.text((56, 368), "Surulere  →  Yaba", font=f_bold(30), fill=INK)
    d.text((56, 418), "3.2 km  ·  ₦1,800  ·  12 min", font=f_reg(22), fill=MUTED)
    d.rounded_rectangle((56, 460, 250, 500), 14, fill=BLUE)
    d.text((100, 468), "Accept", font=f_semi(18), fill=WHITE)

    d.text((40, 560), "This week", font=f_bold(28), fill=INK)
    for i, (day, amt) in enumerate(
        [("Mon", 4200), ("Tue", 6100), ("Wed", 3800), ("Thu", 5400), ("Fri", 18450)]
    ):
        x = 50 + i * 165
        bar_h = int(amt / 18450 * 280)
        d.rounded_rectangle((x, 980 - bar_h, x + 90, 980), 12, fill=BLUE if i < 4 else GOLD)
        d.text((x + 18, 996), day, font=f_reg(18), fill=MUTED)
    d.text((40, 1080), "Payouts go to your Nigerian bank via Paystack.", font=f_reg(20), fill=MUTED)
    return img


def screen_handoff() -> Image.Image:
    w, h = 900, 1480
    img = new_image((w, h), OFF_WHITE)
    d = ImageDraw.Draw(img)
    draw_status_bar(d, w, 28)
    d.text((40, 110), "Confirm handoff", font=f_bold(40), fill=INK)
    d.text((40, 170), "Share this code with your rider\nwhen they arrive.", font=f_reg(26), fill=MUTED, spacing=6)

    d.rounded_rectangle((80, 340, w - 80, 620), 36, fill=WHITE)
    d.text((w / 2, 390), "HANDOFF CODE", font=f_semi(20), fill=MUTED, anchor="ma")
    d.text((w / 2, 490), "4  8  2  1", font=f_bold(72), fill=BLUE, anchor="ma")

    d.rounded_rectangle((80, 680, w - 80, 900), 28, fill=(232, 238, 255))
    d.text((110, 720), "Why a code?", font=f_semi(26), fill=INK)
    d.text(
        (110, 770),
        "It keeps your package safe.\nThe rider confirms pickup and\ndrop-off with this PIN.",
        font=f_reg(24),
        fill=MUTED,
        spacing=6,
    )
    d.rounded_rectangle((80, 980, w - 80, 1100), 28, fill=BLUE)
    d.text((w / 2, 1040), "Rider has arrived", font=f_bold(28), fill=WHITE, anchor="mm")
    return img


def screen_chat() -> Image.Image:
    w, h = 900, 1480
    img = new_image((w, h), OFF_WHITE)
    d = ImageDraw.Draw(img)
    draw_status_bar(d, w, 28)
    d.ellipse((40, 100, 108, 168), fill=BLUE)
    d.text((58, 116), "C", font=f_bold(28), fill=WHITE)
    d.text((128, 108), "Chinedu", font=f_bold(30), fill=INK)
    d.text((128, 148), "Rider  ·  Online", font=f_reg(20), fill=GREEN)
    d.rounded_rectangle((w - 180, 112, w - 40, 168), 20, fill=BLUE)
    d.text((w - 158, 126), "Call", font=f_semi(22), fill=WHITE)

    bubbles = [
        (False, "I'm downstairs at the gate."),
        (True, "Coming out now. Code is 4821."),
        (False, "Got it — see you in 2 mins."),
    ]
    y = 220
    for mine, text in bubbles:
        tw = 520
        x = w - tw - 40 if mine else 40
        fill = BLUE if mine else WHITE
        color = WHITE if mine else INK
        d.rounded_rectangle((x, y, x + tw, y + 100), 24, fill=fill)
        d.text((x + 24, y + 32), text, font=f_reg(22), fill=color)
        y += 130

    d.rounded_rectangle((40, 1360, w - 160, 1448), 28, fill=WHITE)
    d.text((64, 1388), "Message your rider…", font=f_reg(22), fill=MUTED)
    d.ellipse((w - 132, 1360, w - 40, 1452), fill=BLUE)
    return img


SCREENS = [
    ("01-book-delivery.png", "Send anything,\nanywhere in the city.", "Book a package in seconds and a nearby\nrider picks it up.", screen_home),
    ("02-live-tracking.png", "Watch your rider\nin real time.", "Live map, ETA, and a safe handoff code\nfor every delivery.", screen_tracking),
    ("03-pay-securely.png", "Pay the way\nthat works for you.", "Card via Paystack or cash on delivery.\nClear prices, no surprises.", screen_pay),
    ("04-earn-as-rider.png", "Earn on your\nown schedule.", "Go online, accept jobs, and get paid\nto your Nigerian bank account.", screen_rider),
    ("05-safe-handoff.png", "Every package\nhanded off safely.", "A one-time PIN confirms pickup and\ndrop-off between you and your rider.", screen_handoff),
    ("06-chat-and-call.png", "Chat or call\nyour rider.", "In-app messages and voice calls so\ncoordination stays in Ridely.", screen_chat),
]


def make_phone_screenshot(headline: str, sub: str, screen_fn) -> Image.Image:
    w, h = 1080, 1920
    scale = 2
    canvas = screenshot_canvas(w * scale, h * scale, headline, sub)
    screen = screen_fn()
    screen = screen.resize((900 * 2, 1480 * 2), Image.Resampling.LANCZOS)
    # Rebuild canvas at 2x with larger type
    canvas = new_image((w * scale, h * scale), BLUE)
    circles(canvas)
    d = ImageDraw.Draw(canvas)
    d.text((120, 140), headline, font=f_bold(118), fill=WHITE, spacing=4)
    d.text((120, 430), sub, font=f_reg(44), fill=(255, 255, 255, 235), spacing=10)
    place_phone(canvas, screen, 640)
    return downscale(canvas, (w, h))


def make_tablet_screenshot(screen_fn, size: tuple[int, int]) -> Image.Image:
    w, h = size
    scale = 2
    canvas = new_image((w * scale, h * scale), BLUE)
    circles(canvas)
    screen = screen_fn().resize((int(w * scale * 0.62), int(h * scale * 0.72)), Image.Resampling.LANCZOS)
    place_phone(canvas, screen, int(h * scale * 0.12))
    return downscale(canvas, size)


def make_play_icon_512() -> Image.Image:
    return make_app_icon(512)


def main() -> None:
    print("Generating Ridely store assets…")
    EXPO_IMAGES.mkdir(parents=True, exist_ok=True)
    for folder in (PHONE_DIR, TABLET7_DIR, TABLET10_DIR):
        folder.mkdir(parents=True, exist_ok=True)

    icon = make_app_icon(1024)
    save(icon, EXPO_IMAGES / "icon.png")
    adaptive_path = EXPO_IMAGES / "adaptive-icon.png"
    if (EXPO_IMAGES / "adaptive-icon-source.png").exists() and adaptive_path.exists():
        print(f"  keeping custom {adaptive_path.relative_to(ROOT)}")
    else:
        save(make_adaptive_foreground(1024), adaptive_path)
    save(make_splash_icon(1024), EXPO_IMAGES / "splash-icon.png")
    save(make_favicon(192), EXPO_IMAGES / "favicon.png")
    save(make_notification_icon(96), EXPO_IMAGES / "notification-icon.png")
    save(make_play_icon_512(), GRAPHICS / "icon-512.png")
    save(icon, GRAPHICS / "icon-1024.png")
    save(make_feature_graphic(), GRAPHICS / "feature-graphic-1024x500.png", flatten=True)

    phone_images = []
    for name, headline, sub, fn in SCREENS:
        img = make_phone_screenshot(headline, sub, fn)
        save(img, PHONE_DIR / name, flatten=True)
        phone_images.append((fn, img))

    save(make_tablet_screenshot(screen_home, (1200, 1920)), TABLET7_DIR / "01-book-delivery.png", flatten=True)
    save(make_tablet_screenshot(screen_tracking, (1200, 1920)), TABLET7_DIR / "02-live-tracking.png", flatten=True)
    save(make_tablet_screenshot(screen_home, (1600, 2560)), TABLET10_DIR / "01-book-delivery.png", flatten=True)
    save(make_tablet_screenshot(screen_tracking, (1600, 2560)), TABLET10_DIR / "02-live-tracking.png", flatten=True)
    print("Done.")


if __name__ == "__main__":
    main()
