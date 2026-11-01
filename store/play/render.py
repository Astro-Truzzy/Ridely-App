"""Render the Play Store listing art in store/play/templates/store-art.html to PNG.

    python store/play/render.py            # everything
    python store/play/render.py phone-02   # one shot

Uses headless Microsoft Edge (ships with Windows) or Chrome, plus Pillow to flatten
alpha (Play rejects transparent feature graphics and screenshots) and verify sizes.
"""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / 'templates' / 'store-art.html'
GRAPHICS = HERE / 'graphics'

# shot id -> (output path, expected pixel size). CSS canvas is rendered at 2x.
SHOTS = {
    'phone-01': ('screenshots/phone/01-book-delivery.png', (1080, 1920)),
    'phone-02': ('screenshots/phone/02-live-tracking.png', (1080, 1920)),
    'phone-03': ('screenshots/phone/03-pay-securely.png', (1080, 1920)),
    'phone-04': ('screenshots/phone/04-earn-as-rider.png', (1080, 1920)),
    'phone-05': ('screenshots/phone/05-safe-handoff.png', (1080, 1920)),
    'phone-06': ('screenshots/phone/06-chat-and-call.png', (1080, 1920)),
    'tablet7-01': ('screenshots/tablet-7/01-book-delivery.png', (1200, 1920)),
    'tablet7-02': ('screenshots/tablet-7/02-live-tracking.png', (1200, 1920)),
    'tablet10-01': ('screenshots/tablet-10/01-book-delivery.png', (1600, 2560)),
    'tablet10-02': ('screenshots/tablet-10/02-live-tracking.png', (1600, 2560)),
    'feature': ('feature-graphic-1024x500.png', (1024, 500)),
}

BROWSERS = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    shutil.which('google-chrome') or '',
    shutil.which('chromium') or '',
]


def find_browser() -> str:
    for b in BROWSERS:
        if b and os.path.exists(b):
            return b
    sys.exit('No Edge/Chrome found. Install one or add its path to BROWSERS.')


def render(browser: str, shot: str, out: Path, size: tuple[int, int]) -> None:
    w, h = size[0] // 2, size[1] // 2
    url = TEMPLATE.as_uri() + f'?shot={shot}'
    with tempfile.TemporaryDirectory() as profile:
        tmp = Path(profile) / 'shot.png'
        subprocess.run(
            [
                browser,
                '--headless=new',
                '--disable-gpu',
                '--hide-scrollbars',
                '--allow-file-access-from-files',
                f'--user-data-dir={profile}',
                '--force-device-scale-factor=2',
                f'--window-size={w},{h}',
                '--virtual-time-budget=6000',
                f'--screenshot={tmp}',
                url,
            ],
            check=True,
            capture_output=True,
            timeout=120,
        )
        img = Image.open(tmp)
        if img.size != size:
            img = img.crop((0, 0, size[0], size[1])) if img.width >= size[0] and img.height >= size[1] else img
        if img.size != size:
            sys.exit(f'{shot}: rendered {img.size}, expected {size}')
        out.parent.mkdir(parents=True, exist_ok=True)
        img.convert('RGB').save(out, optimize=True)  # 24-bit, no alpha
    print(f'{shot:12s} -> {out.relative_to(HERE)}  {size[0]}x{size[1]}')


def main() -> None:
    browser = find_browser()
    wanted = sys.argv[1:] or list(SHOTS)
    for shot in wanted:
        rel, size = SHOTS[shot]
        render(browser, shot, GRAPHICS / rel, size)


if __name__ == '__main__':
    main()
