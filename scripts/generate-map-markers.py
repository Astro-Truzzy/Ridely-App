"""Generate transparent map marker PNGs for pickup, dropoff, and rider."""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'markers')
os.makedirs(OUT, exist_ok=True)
SIZE = 128


def draw_pin(color, draw_icon):
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = SIZE // 2, 48
    r = 36
    # Soft drop shadow
    d.ellipse([cx - r + 2, cy - r + 4, cx + r + 2, cy + r + 4], fill=(0, 0, 0, 45))
    # Tip
    tip_y = SIZE - 8
    d.polygon([(cx - 22, cy + 18), (cx + 22, cy + 18), (cx, tip_y)], fill=color)
    # Circle head
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    # White inner circle
    inner = 22
    d.ellipse([cx - inner, cy - inner, cx + inner, cy + inner], fill=(255, 255, 255, 255))
    draw_icon(d, cx, cy)
    # White rim
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


def draw_rider(color):
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = SIZE // 2
    r = 48
    d.ellipse([cx - r + 2, cy - r + 4, cx + r + 2, cy + r + 4], fill=(0, 0, 0, 50))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 255), width=5)
    white = (255, 255, 255, 255)
    d.ellipse([cx - 28, cy + 2, cx - 10, cy + 20], outline=white, width=3)
    d.ellipse([cx + 10, cy + 2, cx + 28, cy + 20], outline=white, width=3)
    d.line([(cx - 19, cy + 11), (cx, cy - 2), (cx + 19, cy + 11)], fill=white, width=3)
    d.line([(cx, cy - 2), (cx, cy - 14)], fill=white, width=3)
    d.line([(cx - 10, cy - 14), (cx + 8, cy - 14)], fill=white, width=3)
    d.line([(cx, cy - 2), (cx - 8, cy + 11)], fill=white, width=3)
    return img


def main():
    pickup = draw_pin((16, 185, 129, 255), icon_package)
    dropoff = draw_pin((239, 68, 68, 255), icon_destination)
    rider = draw_rider((90, 71, 255, 255))

    pickup.save(os.path.join(OUT, 'marker-pickup.png'), 'PNG')
    dropoff.save(os.path.join(OUT, 'marker-dropoff.png'), 'PNG')
    rider.save(os.path.join(OUT, 'marker-rider.png'), 'PNG')
    print('Generated markers in', OUT)


if __name__ == '__main__':
    main()
