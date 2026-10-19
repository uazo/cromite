#!/usr/bin/env python3
# Copyright 2026 The CromIKO Authors
# License: GPL-3.0-only - https://spdx.org/licenses/GPL-3.0-only.html
"""Draws the Windows icons and logos of CromIKO (CromIKO-Windows.patch) from
the logo SVG:

  chrome/app/theme/chromium/win/chromium.ico, app_list.ico
                     the app: the white mascot on the charcoal tile, like the
                     Android app icon
  .../win/incognito.ico
                     the shortcut of an incognito window: on a dark periwinkle tile
  .../win/chromium_doc.ico, chromium_pdf.ico
                     web pages and PDF files: a page with the tile
  .../win/tiles/Logo.png, SmallLogo.png
                     the tiles of the Start menu: the white mascot (Windows
                     draws the tile color behind it)
  chrome/app/theme/default_{100,200}_percent/chromium/product_logo_{16,32}.png
                     the small logo of the browser UI: the tile
  components/resources/default_{100,200}_percent/chromium/product_logo.png,
  product_logo_white.png
                     the logo with the name, for light and dark pages

Usage (needs Node.js with Playwright, and Pillow):

  python3 gen_windows_icons.py cromiko-logo.svg out
  python3 gen_windows_icons.py cromiko-logo.svg out --install ~/chromium/src

The first writes the files into out/ and out/preview.png; the second also
copies them into a Chromium checkout.
"""
import io
import json
import os
import shutil
import struct
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gen_icons import CHARCOAL, TILE_RADIUS, load_paths  # noqa: E402

WHITE = '#FFFFFF'
PERI = '#5C7CFC'
GREY_TEXT = '#5F6368'   # the text of Chromium's product_logo.png
INCOGNITO = '#2F3A8F'   # a dark periwinkle, for incognito windows

WIN = 'chrome/app/theme/chromium/win/'
ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]

# The parts of the logo SVG: the mascot (body, face, eyes, gap of the ring,
# highlight, ring and feet, ring highlight, star) and the letters.
MASCOT_BOX = (455, 583, 600, 495)     # x, y, width, height in the logo
WORD_BOX = (1030, 770, 1085, 212)


def mascot(P, style):
    """The mascot as SVG paths in logo coordinates. 'light': white with a
    charcoal face, for dark tiles; 'logo': charcoal, as in the logo."""
    body, face = (WHITE, CHARCOAL) if style == 'light' else (CHARCOAL, WHITE)

    def path(d, fill, evenodd=False):
        return '<path d="%s" fill="%s"%s/>' % (d, fill, ' fill-rule="evenodd"' if evenodd else '')
    # The gap inside the ring (Pfad 5) is a hole, so the mascot works on any background.
    return (path(P['Pfad 1'] + ' ' + P['Pfad 5'], body, True) + path(P['Pfad 2'], face)
            + path(P['Pfad 3'], body) + path(P['Pfad 4'], body) + path(P['Pfad 6'], face)
            + path(P['Pfad 7'], body) + path(P['Pfad 8'], PERI) + path(P['Pfad 18'], PERI))


def letters(P, color):
    def path(d, evenodd=False):
        return '<path d="%s" fill="%s"%s/>' % (d, color, ' fill-rule="evenodd"' if evenodd else '')
    return (path(P['Pfad 13']) + path(P['Pfad 17']) + path(P['Pfad 14'] + ' ' + P['Pfad 15'], True)
            + path(P['Pfad 11']) + path(P['Pfad 16']) + path(P['Pfad 12'])
            + path(P['Pfad 9'] + ' ' + P['Pfad 10'], True))


def place(content, box, x, y, w, h):
    """Fits |content| (in logo coordinates, |box|) centered into x, y, w, h."""
    bx, by, bw, bh = box
    s = min(w / bw, h / bh)
    tx = x + (w - bw * s) / 2 - bx * s
    ty = y + (h - bh * s) / 2 - by * s
    return '<g transform="translate(%.4f %.4f) scale(%.6f)">%s</g>' % (tx, ty, s, content)


def tile(P, x, y, side, color=CHARCOAL):
    """The app icon: a rounded tile with the white mascot, 78% of its width."""
    m = side * 0.11
    return ('<rect x="%.4f" y="%.4f" width="%.4f" height="%.4f" rx="%.4f" fill="%s"/>'
            % (x, y, side, side, side * TILE_RADIUS, color)
            + place(mascot(P, 'light'), MASCOT_BOX, x + m, y + m, side - 2 * m, side - 2 * m))


def svg(width, height, content):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
            'viewBox="0 0 %d %d">%s</svg>' % (width, height, width, height, content))


def app_icon(P, size, color=CHARCOAL):
    # Small icons use all of their pixels; large ones keep a little margin.
    side = size if size <= 32 else size * 0.94
    o = (size - side) / 2
    return svg(size, size, tile(P, o, o, side, color))


def page(P, size, label):
    """A page with a folded corner, the tile, and |label| (like PDF)."""
    s = size / 256
    w, h = 184 * s, 236 * s
    x, y = (size - w) / 2, (size - h) / 2
    fold = 52 * s
    body = ('<path d="M%.3f,%.3f H%.3f L%.3f,%.3f V%.3f H%.3f Z" fill="#FFFFFF" '
            'stroke="#C5C8D0" stroke-width="%.3f"/>' % (
                x, y, x + w - fold, x + w, y + fold, y + h, x, max(1, 4 * s)))
    body += ('<path d="M%.3f,%.3f V%.3f H%.3f Z" fill="#E3E5EC"/>'
             % (x + w - fold, y, y + fold, x + w))
    side = 120 * s
    body += tile(P, (size - side) / 2, y + h - side - 34 * s, side)
    if label and size >= 32:
        body += ('<text x="%.3f" y="%.3f" font-family="Roboto, Arial, sans-serif" '
                 'font-weight="700" font-size="%.3f" fill="%s" text-anchor="middle">%s</text>'
                 % (size / 2, y + 64 * s, 40 * s, PERI, label))
    return svg(size, size, body)


def jobs(P):
    out = []

    def job(path, width, height, doc):
        out.append({'out': path, 'width': width, 'height': height, 'svg': doc})

    for size in ICO_SIZES:
        job('ico/app/%d.png' % size, size, size, app_icon(P, size))
        job('ico/incognito/%d.png' % size, size, size, app_icon(P, size, INCOGNITO))
        job('ico/doc/%d.png' % size, size, size, page(P, size, ''))
        job('ico/pdf/%d.png' % size, size, size, page(P, size, 'PDF'))
    # Start menu tiles: the white mascot, 40% of the tile like Chromium's logo.
    for name, size in (('Logo.png', 600), ('SmallLogo.png', 176)):
        m = size * 0.3
        job(WIN + 'tiles/' + name, size, size,
            svg(size, size, place(mascot(P, 'light'), MASCOT_BOX, m, m, size - 2 * m, size - 2 * m)))
    for scale, folder in ((1, 'default_100_percent'), (2, 'default_200_percent')):
        for logical in (16, 32):
            px = logical * scale
            job('chrome/app/theme/%s/chromium/product_logo_%d.png' % (folder, logical), px, px,
                app_icon(P, px))
        # The logo with the name, 171 x 32 like Chromium's: the tile, then the letters.
        w, h = 171 * scale, 32 * scale
        for name, color in (('product_logo.png', GREY_TEXT), ('product_logo_white.png', WHITE)):
            content = tile(P, 0, 0, h)
            content += place(letters(P, color), WORD_BOX, h * 1.25, h * 0.2, w - h * 1.25, h * 0.6)
            job('components/resources/%s/chromium/%s' % (folder, name), w, h, svg(w, h, content))
    return out


def write_ico(path, images):
    """Writes the RGBA |images| as an .ico file like the ones of Windows: the
    small sizes (up to 48 px) as 32-bit bitmaps with a mask, the large ones as
    PNG, which Windows reads since Vista."""
    entries, blobs = [], []
    for im in images:
        w, h = im.size
        if w > 48:
            data = io.BytesIO()
            im.save(data, format='PNG', optimize=True)
            blob = data.getvalue()
        else:
            pixels = im.tobytes('raw', 'BGRA')
            rows = [pixels[y * w * 4:(y + 1) * w * 4] for y in range(h)]
            # The AND mask: 1 bit per pixel, rows padded to 32 bits, set where
            # the pixel is fully transparent.
            mask_stride = (w + 31) // 32 * 4
            mask_rows = []
            alpha = im.getchannel('A').tobytes()
            for y in range(h):
                row = bytearray(mask_stride)
                for x in range(w):
                    if alpha[y * w + x] == 0:
                        row[x // 8] |= 0x80 >> (x % 8)
                mask_rows.append(bytes(row))
            header = struct.pack('<IiiHHIIiiII', 40, w, h * 2, 1, 32, 0,
                                 len(pixels) + mask_stride * h, 0, 0, 0, 0)
            blob = header + b''.join(reversed(rows)) + b''.join(reversed(mask_rows))
        entries.append((w, h, blob))
        blobs.append(blob)
    out = struct.pack('<HHH', 0, 1, len(entries))
    offset = 6 + 16 * len(entries)
    for w, h, blob in entries:
        out += struct.pack('<BBBBHHII', w % 256, h % 256, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
    with open(path, 'wb') as f:
        f.write(out + b''.join(blobs))


RENDER = r"""
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const [jobsFile, outRoot] = process.argv.slice(2);
  const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const job of jobs) {
    await page.setViewportSize({ width: job.width, height: job.height });
    await page.setContent('<html><body style="margin:0;background:transparent">' +
        job.svg.replace('<svg ', '<svg style="display:block" ') + '</body></html>');
    const out = path.join(outRoot, job.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, omitBackground: true });
  }
  await browser.close();
})();
"""


def main():
    from PIL import Image

    args = sys.argv[1:]
    install_dir = None
    if '--install' in args:
        i = args.index('--install')
        install_dir = args[i + 1]
        args = args[:i] + args[i + 2:]
    svg_path, out_dir = args
    P = load_paths(svg_path)
    os.makedirs(out_dir, exist_ok=True)
    all_jobs = jobs(P)
    json.dump(all_jobs, open(os.path.join(out_dir, 'jobs.json'), 'w'))
    render = os.path.join(out_dir, 'render.js')
    open(render, 'w').write(RENDER)
    subprocess.run(['node', render, os.path.join(out_dir, 'jobs.json'), out_dir], check=True)

    files = [j['out'] for j in all_jobs if not j['out'].startswith('ico/')]
    for name, targets in (('app', ['chromium.ico', 'app_list.ico']), ('incognito', ['incognito.ico']),
                          ('doc', ['chromium_doc.ico']), ('pdf', ['chromium_pdf.ico'])):
        images = [Image.open(os.path.join(out_dir, 'ico/%s/%d.png' % (name, s))).convert('RGBA')
                  for s in ICO_SIZES]
        for target in targets:
            path = os.path.join(out_dir, WIN + target)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            write_ico(path, images)
            files.append(WIN + target)
    for f in files:
        if f.endswith('.png'):
            Image.open(os.path.join(out_dir, f)).convert('RGBA').save(
                os.path.join(out_dir, f), optimize=True)

    # A preview on light and dark backgrounds: each icon at 128, 48, 32 and 16 px.
    preview = Image.new('RGBA', (1240, 420), '#F1F2F8')
    preview.paste(Image.new('RGBA', (1240, 210), '#1E1F25'), (0, 210))
    for i, name in enumerate(('app', 'incognito', 'doc', 'pdf')):
        for y in (20, 230):
            x = 20 + i * 150
            for size, (dx, dy) in ((128, (0, 0)), (48, (0, 140)), (32, (60, 148)), (16, (104, 156))):
                im = Image.open(os.path.join(out_dir, 'ico/%s/%d.png' % (name, size))).convert('RGBA')
                preview.paste(im, (x + dx, y + dy), im)
    for f, y in (('components/resources/default_200_percent/chromium/product_logo.png', 40),
                 ('components/resources/default_200_percent/chromium/product_logo_white.png', 250)):
        im = Image.open(os.path.join(out_dir, f)).convert('RGBA')
        preview.paste(im, (630, y), im)
    logo = Image.open(os.path.join(out_dir, WIN + 'tiles/Logo.png')).convert('RGBA').resize((150, 150))
    back = Image.new('RGBA', (150, 150), CHARCOAL)
    back.paste(logo, (0, 0), logo)
    preview.paste(back, (1060, 30))
    preview.save(os.path.join(out_dir, 'preview.png'))

    if install_dir:
        for f in sorted(files):
            dest = os.path.join(install_dir, f)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy(os.path.join(out_dir, f), dest)
        print('Installed %d files into %s' % (len(files), install_dir))
    print('Wrote %s' % out_dir)


if __name__ == '__main__':
    main()
