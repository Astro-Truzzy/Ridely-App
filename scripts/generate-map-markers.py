"""Generate transparent map marker PNGs for pickup, dropoff, and rider."""
from collections import deque
from PIL import Image, ImageChops, ImageDraw, ImageFilter
import os
import shutil

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'markers')
os.makedirs(OUT, exist_ok=True)
SIZE = 128
RIDER_SIZE = 256

# Ridely brand blue
RIDELY_BLUE = (23, 74, 255, 255)
RIDELY_BLUE_DARK = (14, 52, 210, 255)

RIDER_SOURCE_CANDIDATES = [
    os.path.join(OUT, 'rider-illustration.png'),
]


def draw_pin(color, draw_icon):
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = SIZE // 2, 48
    r = 36
    d.ellipse([cx - r + 2, cy - r + 4, cx + r + 2, cy + r + 4], fill=(0, 0, 0, 45))
    tip_y = SIZE - 8
    d.polygon([(cx - 22, cy + 18), (cx + 22, cy + 18), (cx, tip_y)], fill=color)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    inner = 22
    d.ellipse([cx - inner, cy - inner, cx + inner, cy + inner], fill=(255, 255, 255, 255))
    draw_icon(d, cx, cy)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 230), width=3)
    return img


def icon_package(d, cx, cy):
    color = (16, 185, 129)
    box = [cx - 12, cy - 8, cx + 12, cy + 12]
    d.rectangle(box, outline=color, width=3)
    d.line([(cx, cy - 8), (cx, cy + 12)], fill=color, width=2)
    d.line([(cx - 12, cy + 2), (cx + 12, cy + 2)], fill=color, width=2)
    d.line([(cx - 12, cy - 8), (cx, cy - 14), (cx + 12, cy - 8)], fill=color, width=2)


def icon_destination(d, cx, cy):
    color = (239, 68, 68)
    d.ellipse([cx - 8, cy - 12, cx + 8, cy + 4], outline=color, width=3)
    d.ellipse([cx - 3, cy - 7, cx + 3, cy - 1], fill=color)
    d.polygon([(cx - 2, cy + 2), (cx + 2, cy + 2), (cx, cy + 14)], fill=color)


def _is_near_white(pixel, threshold=242):
    r, g, b = pixel[:3]
    return (
        r >= threshold
        and g >= threshold
        and b >= threshold
        and abs(r - g) < 18
        and abs(g - b) < 18
    )


def knock_out_background(im, threshold=242):
    """Flood-fill near-white pixels from the image edges so interior whites stay."""
    rgba = im.convert('RGBA')
    w, h = rgba.size
    pix = rgba.load()
    seen = bytearray(w * h)
    q = deque()

    def idx(x, y):
        return y * w + x

    def maybe_queue(x, y):
        i = idx(x, y)
        if seen[i]:
            return
        if _is_near_white(pix[x, y], threshold):
            seen[i] = 1
            q.append((x, y))

    for x in range(w):
        maybe_queue(x, 0)
        maybe_queue(x, h - 1)
    for y in range(h):
        maybe_queue(0, y)
        maybe_queue(w - 1, y)

    while q:
        x, y = q.popleft()
        pix[x, y] = (255, 255, 255, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                maybe_queue(nx, ny)

    # Feather anti-aliased fringe along the cutout
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a == 0:
                continue
            if not _is_near_white((r, g, b), 220):
                continue
            edge = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < w and 0 <= ny < h) or pix[nx, ny][3] == 0:
                    edge = True
                    break
            if edge:
                whiteness = (r + g + b) / 3
                alpha = int(max(0, min(255, (255 - whiteness) * 8)))
                pix[x, y] = (r, g, b, alpha)
    return rgba


def crop_to_alpha(im, pad=4):
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def circle_mask(size):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).ellipse((1, 1, size - 2, size - 2), fill=255)
    return m.filter(ImageFilter.GaussianBlur(0.6))


def fit_into_circle(src, diameter, padding):
    """Scale illustration to fit inside a circle (contain) and center it."""
    inner = max(8, diameter - padding * 2)
    src = src.convert('RGBA')
    sw, sh = src.size
    scale = min(inner / sw, inner / sh)
    nw, nh = max(1, int(sw * scale)), max(1, int(sh * scale))
    fitted = src.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (diameter, diameter), (0, 0, 0, 0))
    canvas.paste(fitted, ((diameter - nw) // 2, (diameter - nh) // 2), fitted)
    canvas.putalpha(ImageChops.multiply(canvas.split()[-1], circle_mask(diameter)))
    return canvas


def pin_silhouette(size, cx, cy, radius, tip_y, half_width):
    sil = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(sil)
    d.polygon(
        [(cx - half_width, cy + radius * 0.35), (cx + half_width, cy + radius * 0.35), (cx, tip_y)],
        fill=255,
    )
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=255)
    return sil.filter(ImageFilter.GaussianBlur(0.4))


def gradient_fill(size, top_color, bottom_color):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(top_color[0] + (bottom_color[0] - top_color[0]) * t)
        g = int(top_color[1] + (bottom_color[1] - top_color[1]) * t)
        b = int(top_color[2] + (bottom_color[2] - top_color[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b, 255)
    return img


def find_rider_source():
    env = os.environ.get('RIDER_ILLUSTRATION')
    if env and os.path.isfile(env):
        return env
    for path in RIDER_SOURCE_CANDIDATES:
        if os.path.isfile(path):
            return os.path.abspath(path)
    return None


def make_rider_marker(illustration_path, max_size=RIDER_SIZE):
    """Transparent cropped scooter — keep the art, only cut background and scale."""
    rider = knock_out_background(Image.open(illustration_path))
    rider = crop_to_alpha(rider, pad=6)
    sw, sh = rider.size
    scale = min(max_size / sw, max_size / sh, 1.0)
    nw, nh = max(1, int(round(sw * scale))), max(1, int(round(sh * scale)))
    if (nw, nh) != (sw, sh):
        rider = rider.resize((nw, nh), Image.Resampling.LANCZOS)
    return rider


def main():
    pickup = draw_pin((16, 185, 129, 255), icon_package)
    dropoff = draw_pin((239, 68, 68, 255), icon_destination)
    pickup.save(os.path.join(OUT, 'marker-pickup.png'), 'PNG')
    dropoff.save(os.path.join(OUT, 'marker-dropoff.png'), 'PNG')

    src = find_rider_source()
    if not src:
        raise SystemExit(
            'Rider illustration not found. Save it as assets/markers/rider-illustration.png'
        )

    dest_src = os.path.join(OUT, 'rider-illustration.png')
    if os.path.abspath(src) != os.path.abspath(dest_src):
        shutil.copy2(src, dest_src)
        src = dest_src

    rider = make_rider_marker(src, RIDER_SIZE)
    rider.save(os.path.join(OUT, 'marker-rider.png'), 'PNG', optimize=True)
    print('Generated markers in', os.path.abspath(OUT))
    print('Rider pin from', src, rider.size, rider.mode)


if __name__ == '__main__':
    main()
