"""Draws the CromIKO feature icons (DNS, ad blocking, Fire button, ...) from
the logo: chunky rounded shapes like the mascot, the star of the logo as the
accent, and the visor face of the mascot where it fits.

Each icon is 24x24, like the Material icons of Android. It has a main color
(charcoal, or the tint of the UI) and the star in periwinkle; drawn in one
color, it still reads, as the star never touches the rest.

Usage:

  python3 gen_feature_icons.py cromiko-logo.svg icons
  python3 gen_feature_icons.py cromiko-logo.svg --install ~/chromium/src

The first writes icons/<name>.svg (two colors), icons/<name>_mono.svg (one
color) and icons/preview.html (all icons, light and dark, large and at 24 and
48 px). The second writes the VectorDrawables of the CromIKO patches into a
Chromium checkout (as CromIKO-Settings.patch leaves them): two colors, the
default icon color and the star in the accent color, as the settings show
them. The menu, the shortcuts and the buttons tint them in one color.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_icons import ACCENT, load_paths  # noqa: E402

INK = '#1E212A'   # charcoal of the logo
STAR = 'Pfad 18'
VISOR = 'Pfad 2'
EYES = ['Pfad 3', 'Pfad 4']
# The mascot in one color, like the themed app icon of gen_icons.py: the
# first paths filled even-odd, so that the face, the gap of the ring and the
# highlight are holes and the eyes are filled again, the others solid.
MASCOT_EVEN_ODD = ['Pfad 1', 'Pfad 2', 'Pfad 3', 'Pfad 4', 'Pfad 5', 'Pfad 6']
MASCOT_SOLID = ['Pfad 7', 'Pfad 8']


# --- Paths of the logo -----------------------------------------------------

def parse(d):
    """Returns the commands of a path of absolute M/L/C/Z commands."""
    tokens = re.findall(r'[MLCZ]|-?\d+(?:\.\d+)?', d)
    commands, i = [], 0
    while i < len(tokens):
        cmd = tokens[i]
        i += 1
        n = {'M': 2, 'L': 2, 'C': 6, 'Z': 0}[cmd]
        while True:
            commands.append((cmd, [float(t) for t in tokens[i:i + n]]))
            i += n
            if n == 0 or i >= len(tokens) or tokens[i] in 'MLCZ':
                break
    return commands


def bbox(commands):
    xs = [v for _, a in commands for v in a[0::2]]
    ys = [v for _, a in commands for v in a[1::2]]
    return min(xs), min(ys), max(xs), max(ys)


def fit(box, into):
    """Returns the scale and offsets that fit |box| centered into |into|."""
    x0, y0, x1, y1 = box
    X0, Y0, X1, Y1 = into
    s = min((X1 - X0) / (x1 - x0), (Y1 - Y0) / (y1 - y0))
    return s, (X0 + X1) / 2 - s * (x0 + x1) / 2, (Y0 + Y1) / 2 - s * (y0 + y1) / 2


def place(commands, transform):
    s, tx, ty = transform
    out = []
    for cmd, args in commands:
        pts = ['%.2f,%.2f' % (s * args[k] + tx, s * args[k + 1] + ty)
               for k in range(0, len(args), 2)]
        out.append(cmd + ' '.join(pts))
    return ''.join(out)


class Logo:
    def __init__(self, svg_path):
        paths = load_paths(svg_path)
        self.star = parse(paths[STAR])
        self.visor = parse(paths[VISOR])
        self.eyes = [parse(paths[e]) for e in EYES]
        self.mascot_even_odd = [parse(paths[p]) for p in MASCOT_EVEN_ODD]
        self.mascot_solid = [parse(paths[p]) for p in MASCOT_SOLID]

    def star_in(self, box):
        return place(self.star, fit(bbox(self.star), box))

    def face_in(self, box):
        """The visor and the eyes, for even-odd filling: the visor is a hole
        in the shape under it, the eyes are filled again."""
        t = fit(bbox(self.visor), box)
        return place(self.visor, t) + ''.join(place(e, t) for e in self.eyes)

    def mascot_in(self, box):
        """The whole mascot with its star: (fills, star)."""
        parts = self.mascot_even_odd + self.mascot_solid + [self.star]
        t = fit(bbox([c for part in parts for c in part]), box)
        fills = [''.join(place(p, t) for p in self.mascot_even_odd)]
        fills += [place(p, t) for p in self.mascot_solid]
        return fills, place(self.star, t)


# --- Shapes ----------------------------------------------------------------

def rect(x, y, w, h, r):
    return ('M%g,%g H%g A%g,%g 0 0 1 %g,%g V%g A%g,%g 0 0 1 %g,%g H%g '
            'A%g,%g 0 0 1 %g,%g V%g A%g,%g 0 0 1 %g,%gZ' % (
                x + r, y, x + w - r, r, r, x + w, y + r, y + h - r, r, r,
                x + w - r, y + h, x + r, r, r, x, y + h - r, y + r, r, r, x + r, y))


def circle(cx, cy, r):
    return 'M%g,%g A%g,%g 0 1 0 %g,%g A%g,%g 0 1 0 %g,%gZ' % (
        cx - r, cy, r, r, cx + r, cy, r, r, cx - r, cy)


def icons(logo):
    """Returns {name: (title, main paths, stroked paths, star)}: the main
    paths are filled even-odd, the stroked ones are round lines 2.6 wide."""
    mascot, mascot_star = logo.mascot_in((0.8, 1.2, 23.2, 22.8))
    return {
        'cromiko': ('CromIKO', mascot, [], mascot_star),
        'incognito_tile': ('Incognito tab tile', [
            # A Quick Settings tile: the face of the mascot and two lines of text.
            rect(1.4, 7.8, 19.6, 12, 6) + logo.face_in((3.6, 10.6, 10.8, 17.2))
            + rect(12.4, 11, 5.6, 1.9, 0.95) + rect(12.4, 14.8, 3.8, 1.9, 0.95)], [],
            logo.star_in((16.9, 0.8, 23.3, 7.6))),
        'popup_guard': ('Pop-up guard', [
            # A pop-up in front of the page, with the face of the mascot,
            # which holds it.
            rect(6.8, 8.4, 15, 13.2, 3.2) + logo.face_in((9.2, 11, 19.4, 19))],
            ['M3.3,15.2 V7 A2.6,2.6 0 0 1 5.9,4.4 H14.4'],
            logo.star_in((16.9, 0.8, 23.3, 7.6))),
        'dns': ('CromIKO DNS', [
            rect(2.5, 4, 13.5, 7, 2.6) + rect(2.5, 13, 19, 7.5, 2.6)
            + circle(6.2, 7.5, 1.3) + circle(6.2, 16.75, 1.3)
            + rect(9, 6.8, 4.6, 1.4, 0.7) + rect(9, 16.05, 9.4, 1.4, 0.7)], [],
            logo.star_in((16.9, 1.2, 23, 9.6))),
        'adblock': ('Ad blocking', [
            'M11,2.8 C13.3,4.3 15.6,5 18,5.3 C18.5,5.4 18.8,5.8 18.8,6.3 V11.4 '
            'C18.8,16.1 15.8,19.9 11.4,21.5 C11.1,21.6 10.9,21.6 10.6,21.5 '
            'C6.2,19.9 3.2,16.1 3.2,11.4 V6.3 C3.2,5.8 3.5,5.4 4,5.3 '
            'C6.4,5 8.7,4.3 11,2.8Z'
            + logo.face_in((5.4, 8.6, 16.6, 15.8))], [],
            logo.star_in((17.6, 0.4, 23.4, 6.6))),
        'fire': ('Fire button', [
            'M11.4,2.4 C12.3,5.4 15.6,7.3 16.9,10.6 C18.6,14.8 16,20.9 10.9,20.9 '
            'C6.3,20.9 3.8,17.2 4.6,13.4 C5.1,11 6.6,9.6 7.3,7.9 '
            'C8.3,9 8.7,10.4 8.5,11.7 C10.5,10.2 11.9,6.3 11.4,2.4Z '
            'M11,12.6 C11.4,14.3 13.5,15.1 13.5,17.1 C13.5,18.6 12.3,19.4 11,19.4 '
            'C9.6,19.4 8.4,18.4 8.5,17 C8.6,15.4 10.6,14.7 11,12.6Z'], [],
            logo.star_in((16.7, 1, 23.3, 8.6))),
        'lock': ('Incognito lock', [
            rect(3, 10, 16, 11.5, 3.4) + logo.face_in((5.2, 12.2, 16.8, 19.6))],
            ['M6.9,10.4 V7.4 C6.9,4.6 8.7,2.8 11,2.8 C13.3,2.8 15.1,4.6 15.1,7.4 V10.4'],
            logo.star_in((16.9, 1.4, 23.3, 8.8))),
        'manga': ('Manga mode', [
            rect(2.5, 2.5, 19, 19, 3.4)
            + 'M5,5.8 C5,5.4 5.4,5 5.8,5 H10.6 C11,5 11.4,5.4 11.4,5.8 V10.4 '
              'C11.4,10.8 11,11.2 10.6,11.2 H5.8 C5.4,11.2 5,10.8 5,10.4Z'
            + 'M13.6,5 H18.2 C18.6,5 19,5.4 19,5.8 V9.5 C19,9.9 18.7,10.2 18.3,10.3 '
              'L14.1,11.1 C13.8,11.2 13.6,11 13.6,10.7Z'
            + 'M5,14.2 C5,13.8 5.3,13.5 5.7,13.4 L18.1,11.9 C18.6,11.9 19,12.2 19,12.6 '
              'V18.2 C19,18.6 18.6,19 18.2,19 H5.8 C5.4,19 5,18.6 5,18.2Z'], [],
            logo.star_in((9.4, 13.4, 15, 18.6))),
        'player': ('CromIKO player', [
            place(logo.visor, fit(bbox(logo.visor), (1.6, 5.4, 19.2, 20.4)))
            + 'M8.6,10.3 C8.6,9.6 9.4,9.2 10,9.6 L14.3,12.4 C14.8,12.8 14.8,13.5 '
              '14.3,13.9 L10,16.7 C9.4,17.1 8.6,16.7 8.6,16Z'], [],
            logo.star_in((16.8, 0.8, 23.2, 7.8))),
        'downloads': ('Downloads', [], [
            'M11,3.6 V13.6', 'M6.8,9.6 L11,13.8 L15.2,9.6',
            'M4,16.4 V18.2 C4,19.3 4.9,20.2 6,20.2 H16 C17.1,20.2 18,19.3 18,18.2 V16.4'],
            logo.star_in((16.4, 1.4, 22.8, 8.6))),
        'home_edit': ('Edit home screen', [
            rect(2.5, 2.5, 8.6, 8.6, 2.8) + rect(12.9, 2.5, 8.6, 8.6, 2.8)
            + rect(2.5, 12.9, 8.6, 8.6, 2.8)], [],
            logo.star_in((12.4, 12.2, 22, 22.2))),
        'report': ('Weekly shield report', [
            rect(3, 14.2, 4.8, 7, 2.4) + rect(9.6, 9.6, 4.8, 11.6, 2.4)
            + rect(16.2, 4.4, 4.8, 16.8, 2.4)], [],
            logo.star_in((2.2, 4.4, 8.6, 11.8))),
        'accent': ('Accent color', [
            'M11.6,3 C6.5,3 2.6,6.9 2.6,11.8 C2.6,16.7 6.4,20.8 11.1,20.8 '
            'C12.5,20.8 13.4,19.9 13.4,18.7 C13.4,17.6 12.6,17.1 12.6,16 '
            'C12.6,15 13.4,14.3 14.5,14.3 H16.2 C18.8,14.3 20.8,12.5 20.8,10.1 '
            'C20.8,6.2 16.7,3 11.6,3Z'
            + circle(7.1, 12.6, 1.6) + circle(8.3, 7.9, 1.6) + circle(12.8, 6.5, 1.6)
            + circle(16.2, 9.4, 3.3)], [],
            logo.star_in((13.6, 6.8, 18.8, 12))),
    }


# --- Output ----------------------------------------------------------------

def svg(icon, ink, star_color):
    _, fills, strokes, star = icon
    body = ''.join('<path fill="%s" fill-rule="evenodd" d="%s"/>' % (ink, d) for d in fills)
    body += ''.join(
        '<path fill="none" stroke="%s" stroke-width="2.6" stroke-linecap="round" '
        'stroke-linejoin="round" d="%s"/>' % (ink, d) for d in strokes)
    body += '<path fill="%s" d="%s"/>' % (star_color, star)
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" '
            'viewBox="0 0 24 24">%s</svg>' % body)


def preview(all_icons):
    cells = []
    for name, icon in all_icons.items():
        two = svg(icon, INK, ACCENT)
        dark = svg(icon, '#E6E8F0', ACCENT)
        mono = svg(icon, INK, INK)
        sized = lambda s, px: s.replace('width="24" height="24"',
                                        'width="%d" height="%d"' % (px, px))
        cells.append(
            '<div class="cell"><div class="row">'
            '<div class="tile light">%s</div><div class="tile dark">%s</div></div>'
            '<div class="row small"><span class="light">%s%s</span>'
            '<span class="dark">%s%s</span><span class="light">%s</span></div>'
            '<div class="name">%s</div></div>' % (
                sized(two, 96), sized(dark, 96), sized(two, 24), sized(two, 48),
                sized(dark, 24), sized(dark, 48), sized(mono, 48), icon[0]))
    return ('<!doctype html><html><head><meta charset="utf-8"><style>'
            'body{margin:0;padding:28px;background:#F4F4F8;font:600 15px system-ui,sans-serif;color:#1E212A}'
            'h1{font-size:22px;margin:0 0 4px}p{margin:0 0 22px;color:#5d6070;font-weight:500}'
            '.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:18px}'
            '.cell{background:#fff;border-radius:22px;padding:14px;box-shadow:0 1px 3px #0001}'
            '.row{display:flex;gap:10px;justify-content:center}'
            '.tile{border-radius:18px;padding:14px;display:flex}'
            '.light{background:#F4F4F8}.dark{background:#1E2024}'
            '.small{margin-top:10px;align-items:center}.small span{display:flex;gap:6px;'
            'align-items:center;padding:6px;border-radius:10px}'
            '.name{text-align:center;margin-top:10px}'
            '</style></head><body><h1>CromIKO feature icons</h1>'
            '<p>Two-color on light and dark, at 24 and 48 px, and in one color (last)</p>'
            '<div class="grid">%s</div></body></html>' % ''.join(cells))


THEME_RES = 'components/browser_ui/theme/android/java/res/drawable/'
CHROME_RES = 'chrome/android/java/res/drawable/'
# The drawables in Chromium: the icon of each, and the color of all of it
# when it has one color: the "Edit home screen" button shows its icon as it
# is, in the accent color. The others have two colors.
DRAWABLES = {
    THEME_RES + 'cromiko_ic_dns_24dp.xml': ('dns', None),
    THEME_RES + 'cromiko_ic_adblock_24dp.xml': ('adblock', None),
    THEME_RES + 'cromiko_ic_fire_24dp.xml': ('fire', None),
    THEME_RES + 'cromiko_ic_lock_24dp.xml': ('lock', None),
    THEME_RES + 'cromiko_ic_manga_24dp.xml': ('manga', None),
    THEME_RES + 'cromiko_ic_player_24dp.xml': ('player', None),
    THEME_RES + 'cromiko_ic_downloads_24dp.xml': ('downloads', None),
    CHROME_RES + 'cromiko_ic_home_edit_24dp.xml': ('home_edit', '?attr/colorPrimary'),
    CHROME_RES + 'cromiko_ic_home_screen_24dp.xml': ('home_edit', None),
    THEME_RES + 'cromiko_ic_report_24dp.xml': ('report', None),
    THEME_RES + 'cromiko_ic_accent_24dp.xml': ('accent', None),
    CHROME_RES + 'cromiko_ic_popup_guard_24dp.xml': ('popup_guard', None),
    CHROME_RES + 'cromiko_ic_incognito_tile_24dp.xml': ('incognito_tile', None),
    CHROME_RES + 'cromiko_ic_cromiko_24dp.xml': ('cromiko', None),
}
# The two colors: the default icon color, and the accent color for the star.
MAIN_COLOR = '@macro/default_icon_color'
STAR_COLOR = '?attr/colorPrimary'


def vector_drawable(icon, color):
    """Returns the icon as a VectorDrawable: in the default icon color with
    the star in the accent color, or all in |color|."""
    title, fills, strokes, star = icon
    fill = color or MAIN_COLOR
    paths = ''.join(
        '\n  <path\n      android:fillColor="%s"\n      android:fillType="evenOdd"\n'
        '      android:pathData="%s"/>' % (fill, d) for d in fills)
    paths += ''.join(
        '\n  <path\n      android:strokeColor="%s"\n      android:strokeWidth="2.6"\n'
        '      android:strokeLineCap="round"\n      android:strokeLineJoin="round"\n'
        '      android:pathData="%s"/>' % (fill, d) for d in strokes)
    paths += '\n  <path\n      android:fillColor="%s"\n      android:pathData="%s"/>' % (
        color or STAR_COLOR, star)
    return ('<?xml version="1.0" encoding="utf-8"?>\n<!--\n'
            'Copyright 2026 The CromIKO Authors\n'
            'License: GPL-3.0-only - https://spdx.org/licenses/GPL-3.0-only.html\n'
            'The %s icon, drawn from the CromIKO logo by\n'
            'tools/cromiko/gen_feature_icons.py.\n-->\n'
            '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
            '    android:width="24dp"\n    android:height="24dp"\n'
            '    android:viewportWidth="24"\n    android:viewportHeight="24">%s\n'
            '</vector>\n' % (title, paths))


def install(svg_path, src_dir):
    all_icons = icons(Logo(svg_path))
    for path, (name, color) in DRAWABLES.items():
        out = os.path.join(src_dir, path)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, 'w') as f:
            f.write(vector_drawable(all_icons[name], color))
    print('Wrote %d drawables to %s' % (len(DRAWABLES), src_dir))


def main(svg_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    all_icons = icons(Logo(svg_path))
    for name, icon in all_icons.items():
        with open(os.path.join(out_dir, name + '.svg'), 'w') as f:
            f.write(svg(icon, INK, ACCENT) + '\n')
        with open(os.path.join(out_dir, name + '_mono.svg'), 'w') as f:
            f.write(svg(icon, INK, INK) + '\n')
    html = preview(all_icons)
    with open(os.path.join(out_dir, 'preview.html'), 'w') as f:
        f.write(html)
    print('Wrote %d icons to %s' % (len(all_icons), out_dir))


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[2] == '--install':
        install(sys.argv[1], sys.argv[3])
    else:
        main(*sys.argv[1:3])
