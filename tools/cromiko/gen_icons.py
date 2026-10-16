"""Builds the CromIKO Android icon assets from the logo SVG.

These are the files in build/patches/CromIKO-App-Icon.patch. To regenerate
them (after changing the logo or the colors below):

  python3 gen_icons.py generate cromiko-logo.svg out
  node render_icons.js out/jobs.json out      # needs the playwright package
  python3 gen_icons.py install out ~/chromium/src   # needs Pillow

"generate" writes out/jobs.json (SVG documents and pixel sizes for
render_icons.js) and out/themed_app_icon.xml (the monochrome VectorDrawable).
"install" copies the rendered PNGs and the vector into a Chromium checkout,
saving the opaque background layers as RGB.
"""
import json
import math
import os
import re
import sys
import xml.etree.ElementTree as ET

CHARCOAL = '#1E2024'   # logo charcoal (icon background)
WHITE = '#FFFFFF'
ACCENT = '#5C7CFC'     # logo periwinkle (star and ring highlight)

# Paths of the mascot in the logo SVG, and their fill in the icon, where the
# mascot is drawn white on charcoal (the logo SVG has it charcoal on white).
MASCOT = [
    ('Pfad 1', WHITE),     # head and body, incl. the left part of the ring
    ('Pfad 2', CHARCOAL),  # face
    ('Pfad 3', WHITE),     # eye
    ('Pfad 4', WHITE),     # eye
    ('Pfad 5', CHARCOAL),  # gap inside the left part of the ring
    ('Pfad 6', CHARCOAL),  # forehead highlight
    ('Pfad 7', WHITE),     # ring and feet
    ('Pfad 8', ACCENT),    # ring highlight
    ('Pfad 18', ACCENT),   # star
]
# For the monochrome icon: these are combined with even-odd filling so that
# the face, gap and highlight become holes and the eyes are filled again.
MONO_EVEN_ODD = ['Pfad 1', 'Pfad 2', 'Pfad 3', 'Pfad 4', 'Pfad 5', 'Pfad 6']
MONO_SOLID = ['Pfad 7', 'Pfad 8', 'Pfad 18']

# mdpi pixel sizes (dp) and density multipliers.
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

ADAPTIVE_DP = 108       # adaptive icon layer size
SAFE_RADIUS_DP = 31.5   # mascot must fit in this circle (safe zone is 33dp)
LEGACY_DP = 48          # app_icon.png
LEGACY_TILE_DP = 44     # rounded tile inside app_icon.png
FRE_DP = 130            # fre_product_logo.png (same canvas as Cromite's)
FRE_TILE_DP = 116
TILE_RADIUS = 0.225     # corner radius / tile side, as in the logo's icon
TILE_MASCOT_WIDTH = 0.78  # mascot width / tile side


def load_paths(svg_path):
    root = ET.parse(svg_path).getroot()
    paths = {}
    for el in root.iter('{http://www.w3.org/2000/svg}path'):
        paths[el.get('id')] = el.get('d')
    return paths


def outline_points(d, steps=24):
    """Samples points on a path made of absolute M/L/C/Z commands."""
    tokens = re.findall(r'[MLCZ]|-?\d+(?:\.\d+)?', d)
    pts, i, cur, cmd = [], 0, (0.0, 0.0), None
    while i < len(tokens):
        if tokens[i] in 'MLCZ':
            cmd = tokens[i]
            i += 1
            if cmd == 'Z':
                continue
        nums = lambda n: [float(t) for t in tokens[i:i + n]]
        if cmd in ('M', 'L'):
            cur = tuple(nums(2))
            pts.append(cur)
            i += 2
        elif cmd == 'C':
            x1, y1, x2, y2, x3, y3 = nums(6)
            x0, y0 = cur
            for s in range(1, steps + 1):
                t = s / steps
                mt = 1 - t
                pts.append((mt**3 * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t**3 * x3,
                            mt**3 * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t**3 * y3))
            cur = (x3, y3)
            i += 6
        else:
            raise ValueError('unsupported path command %r' % cmd)
    return pts


def mascot_geometry(paths):
    pts = [p for name, _ in MASCOT for p in outline_points(paths[name])]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    bbox = (min(xs), min(ys), max(xs), max(ys))
    cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
    radius = max(math.hypot(x - cx, y - cy) for x, y in pts)
    return bbox, (cx, cy), radius


def transform_for_circle(center, radius, canvas, fit_radius):
    s = fit_radius / radius
    return s, canvas / 2 - s * center[0], canvas / 2 - s * center[1]


def transform_for_tile(bbox, center, canvas, tile):
    s = tile * TILE_MASCOT_WIDTH / (bbox[2] - bbox[0])
    return s, canvas / 2 - s * center[0], canvas / 2 - s * center[1]


def mascot_svg(paths, transform):
    s, tx, ty = transform
    body = ''.join('<path d="%s" fill="%s"/>' % (paths[name], fill) for name, fill in MASCOT)
    return '<g transform="translate(%.4f %.4f) scale(%.6f)">%s</g>' % (tx, ty, s, body)


def svg_doc(canvas, content):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="{0}" height="{0}" '
            'viewBox="0 0 {0} {0}">{1}</svg>').format(canvas, content)


def tile(canvas, side):
    o = (canvas - side) / 2
    r = side * TILE_RADIUS
    return '<rect x="%.4f" y="%.4f" width="%.4f" height="%.4f" rx="%.4f" fill="%s"/>' % (
        o, o, side, side, r, CHARCOAL)


def vector_drawable(paths, transform, canvas):
    s, tx, ty = transform
    eo = ' '.join(paths[n] for n in MONO_EVEN_ODD)
    out = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<!--',
        'Copyright 2022 The Chromium Authors',
        'Use of this source code is governed by a BSD-style license that can be',
        'found in the LICENSE file.',
        '-->',
        '',
        '<!-- CromIKO mascot, generated by tools/cromiko/gen_icons.py from the logo SVG. -->',
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
        '    android:width="{0}dp"'.format(canvas),
        '    android:height="{0}dp"'.format(canvas),
        '    android:viewportWidth="{0}"'.format(canvas),
        '    android:viewportHeight="{0}">'.format(canvas),
        '    <group',
        '        android:translateX="%.4f"' % tx,
        '        android:translateY="%.4f"' % ty,
        '        android:scaleX="%.6f"' % s,
        '        android:scaleY="%.6f">' % s,
        '        <path',
        '            android:fillType="evenOdd"',
        '            android:pathData="%s"' % eo,
        '            android:fillColor="#000000"/>',
    ]
    for n in MONO_SOLID:
        out += [
            '        <path',
            '            android:pathData="%s"' % paths[n],
            '            android:fillColor="#000000"/>',
        ]
    out += ['    </group>', '</vector>', '']
    return '\n'.join(out)


def main(svg_path, out_dir):
    paths = load_paths(svg_path)
    bbox, center, radius = mascot_geometry(paths)
    jobs = []

    base = 'chrome/android/java/res_chromium_base/mipmap-%s/'
    fre = 'components/browser_ui/styles/android/java/res_chromium/drawable-%s/fre_product_logo.png'

    adaptive = transform_for_circle(center, radius, ADAPTIVE_DP, SAFE_RADIUS_DP)
    legacy = transform_for_tile(bbox, center, LEGACY_DP, LEGACY_TILE_DP)
    fre_t = transform_for_tile(bbox, center, FRE_DP, FRE_TILE_DP)
    full_bg = '<rect width="%d" height="%d" fill="%s"/>' % (ADAPTIVE_DP, ADAPTIVE_DP, CHARCOAL)

    for density, mult in DENSITIES.items():
        def job(path, canvas, content, opaque=False):
            px = int(round(canvas * mult))
            jobs.append({'out': path, 'size': px, 'opaque': opaque,
                         'svg': svg_doc(canvas, content)})
        # Adaptive icon: solid charcoal background + transparent mascot foreground.
        job(base % density + 'layered_app_icon_background.png', ADAPTIVE_DP, full_bg, True)
        job(base % density + 'layered_app_icon.png', ADAPTIVE_DP, mascot_svg(paths, adaptive))
        # Legacy icon and in-app product logo: rounded charcoal tile with the mascot.
        job(base % density + 'app_icon.png', LEGACY_DP,
            tile(LEGACY_DP, LEGACY_TILE_DP) + mascot_svg(paths, legacy))
        job(fre % density, FRE_DP, tile(FRE_DP, FRE_TILE_DP) + mascot_svg(paths, fre_t))

    # Preview of the full adaptive icon, for review only.
    jobs.append({'out': 'preview/adaptive_full.png', 'size': 432, 'opaque': True,
                 'svg': svg_doc(ADAPTIVE_DP, full_bg + mascot_svg(paths, adaptive))})

    os.makedirs(out_dir, exist_ok=True)
    json.dump(jobs, open(os.path.join(out_dir, 'jobs.json'), 'w'))
    # The monochrome layer uses a smaller mascot, like upstream's themed icon.
    mono = transform_for_circle(center, radius, ADAPTIVE_DP, 24)
    open(os.path.join(out_dir, 'themed_app_icon.xml'), 'w').write(
        vector_drawable(paths, mono, ADAPTIVE_DP))
    print('mascot bbox', bbox, 'adaptive scale %.4f -> width %.1fdp' % (
        adaptive[0], adaptive[0] * (bbox[2] - bbox[0])))


THEMED_ICON = 'chrome/android/java/res_chromium_base/drawable/themed_app_icon.xml'


def install(out_dir, src_dir):
    import shutil
    from PIL import Image
    for job in json.load(open(os.path.join(out_dir, 'jobs.json'))):
        if job['out'].startswith('preview/'):
            continue
        im = Image.open(os.path.join(out_dir, job['out']))
        im = im.convert('RGB') if job['opaque'] else im.convert('RGBA')
        im.save(os.path.join(src_dir, job['out']), 'PNG', optimize=True)
    shutil.copy(os.path.join(out_dir, 'themed_app_icon.xml'), os.path.join(src_dir, THEMED_ICON))


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == 'generate':
        main(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 4 and sys.argv[1] == 'install':
        install(sys.argv[2], sys.argv[3])
    else:
        sys.exit(__doc__)
