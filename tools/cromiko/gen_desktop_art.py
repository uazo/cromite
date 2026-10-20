#!/usr/bin/env python3
# Copyright 2026 The CromIKO Authors
# License: GPL-3.0-only - https://spdx.org/licenses/GPL-3.0-only.html
"""Draws the pictures of the desktop version of CromIKO (Windows and Linux)
from the logo: for now the banner of the Fire button dialog, the CromIKO
mascot in front of a friendly flame, with embers and the stars of the logo.

Each picture has a light and a dark version (the dialog shows the one that
goes with its background) at 100% and 200%, on a transparent background, so
that it fits any width of the dialog.

Usage:

  python3 gen_desktop_art.py cromiko-logo.svg out
  python3 gen_desktop_art.py cromiko-logo.svg out --install ~/chromium/src

The first writes out/<name>_<theme>_<scale>.png and out/preview.html; with
--install it also copies them into a Chromium checkout as
CromIKO-Windows-Fire-Button.patch uses them
(chrome/app/theme/default_{100,200}_percent/cromiko/).
"""
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_feature_icons import Logo, bbox, fit, icons, place  # noqa: E402
from gen_icons import ACCENT  # noqa: E402

CORAL = '#F07A5A'
AMBER = '#E9A23B'
GOLD = '#FFD36B'
# The colors of each theme: the mascot, its face, the glow.
THEMES = {
    'light': {'ink': '#1E212A', 'face': '#FFFFFF', 'glow': ACCENT, 'glow_alpha': 0.20},
    'dark': {'ink': '#E6E8F0', 'face': '#2A2B31', 'glow': ACCENT, 'glow_alpha': 0.32},
}
WIDTH, HEIGHT = 448, 168


def burn_banner(logo, theme):
    """The banner of the Fire button dialog, WIDTH x HEIGHT."""
    colors = THEMES[theme]
    fire = icons(logo)['fire']
    flame_outer, flame_inner = fire[1][0].split('Z ', 1)
    # The flame, 24 px tall in the icon, rises behind the mascot.
    flame = 'transform="translate(206 8) scale(6.1)"'
    # The mascot, with its face filled in, in front of the flame.
    parts = logo.mascot_even_odd + logo.mascot_solid + [logo.star]
    t = fit(bbox([c for part in parts for c in part]), (118, 30, 252, 162))
    body = ''.join(place(p, t) for p in logo.mascot_even_odd)
    solid = ''.join('<path fill="%s" d="%s"/>' % (colors['ink'], place(p, t))
                    for p in logo.mascot_solid)
    face = place(logo.visor, t)
    mascot_star = place(logo.star, t)
    star = logo.star_in((0, 0, 24, 24))

    def logo_star(x, y, size, opacity):
        return ('<path fill="%s" opacity="%.2f" transform="translate(%g %g) scale(%g)" '
                'd="%s"/>' % (ACCENT, opacity, x - size / 2, y - size / 2, size / 24, star))

    embers = [(262, 34, 3.2, 0.9), (300, 52, 2.4, 0.7), (246, 18, 2.0, 0.6),
              (318, 28, 1.8, 0.5), (284, 12, 1.6, 0.45), (230, 44, 1.5, 0.5)]
    ember_svg = ''.join('<circle cx="%g" cy="%g" r="%g" fill="%s" opacity="%.2f"/>' % (
        x, y, r, GOLD if i % 2 else AMBER, a) for i, (x, y, r, a) in enumerate(embers))
    stars = ''.join(logo_star(*s) for s in [
        (96, 46, 18, 0.95), (352, 40, 14, 0.85), (76, 120, 10, 0.6), (370, 118, 12, 0.7),
        (330, 150, 8, 0.5), (122, 152, 7, 0.45)])
    return '''<svg xmlns="http://www.w3.org/2000/svg" width="%(w)d" height="%(h)d" viewBox="0 0 %(w)d %(h)d">
  <defs>
    <radialGradient id="glow" cx="50%%" cy="58%%" r="50%%">
      <stop offset="0" stop-color="%(glow)s" stop-opacity="%(glow_alpha)s"/>
      <stop offset="1" stop-color="%(glow)s" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="%(coral)s"/>
      <stop offset="0.55" stop-color="%(amber)s"/>
      <stop offset="1" stop-color="%(gold)s"/>
    </linearGradient>
  </defs>
  <ellipse cx="224" cy="92" rx="196" ry="70" fill="url(#glow)"/>
  <g %(flame)s>
    <path fill="url(#flame)" d="%(flame_outer)sZ"/>
    <path fill="%(gold)s" opacity="0.85" d="%(flame_inner)s"/>
  </g>
  %(embers)s
  <path fill="%(face)s" d="%(face_path)s"/>
  <path fill="%(ink)s" fill-rule="evenodd" d="%(body)s"/>
  %(solid)s
  <path fill="%(accent)s" d="%(mascot_star)s"/>
  %(stars)s
</svg>''' % dict(w=WIDTH, h=HEIGHT, glow=colors['glow'], glow_alpha=colors['glow_alpha'],
                 coral=CORAL, amber=AMBER, gold=GOLD, flame=flame, flame_outer=flame_outer,
                 flame_inner=flame_inner, embers=ember_svg, face=colors['face'], face_path=face,
                 ink=colors['ink'], body=body, solid=solid, accent=ACCENT,
                 mascot_star=mascot_star, stars=stars)


RENDER = r"""
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const [jobsFile, outDir] = process.argv.slice(2);
  const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
  const browser = await chromium.launch();
  for (const job of jobs) {
    const page = await browser.newPage({
        viewport: { width: job.width, height: job.height }, deviceScaleFactor: job.scale });
    await page.setContent('<html><body style="margin:0;background:transparent">' +
        job.svg.replace('<svg ', '<svg style="display:block" ') + '</body></html>');
    await page.screenshot({ path: path.join(outDir, job.out), omitBackground: true });
    await page.close();
  }
  await browser.close();
})();
"""

# The pictures in Chromium: (name, theme) -> file of the theme resources.
INSTALL = {
    ('burn_banner', 'light'): 'cromiko/burn_banner.png',
    ('burn_banner', 'dark'): 'cromiko/burn_banner_dark.png',
}


def main():
    args = sys.argv[1:]
    install_dir = None
    if '--install' in args:
        i = args.index('--install')
        install_dir = args[i + 1]
        args = args[:i] + args[i + 2:]
    svg_path, out_dir = args
    logo = Logo(svg_path)
    os.makedirs(out_dir, exist_ok=True)
    jobs = []
    for theme in THEMES:
        svg = burn_banner(logo, theme)
        with open(os.path.join(out_dir, 'burn_banner_%s.svg' % theme), 'w') as f:
            f.write(svg + '\n')
        for scale in (1, 2):
            jobs.append({'svg': svg, 'width': WIDTH, 'height': HEIGHT, 'scale': scale,
                         'out': 'burn_banner_%s_%dx.png' % (theme, scale)})
    jobs_file = os.path.join(out_dir, 'jobs.json')
    with open(jobs_file, 'w') as f:
        json.dump(jobs, f)
    render = os.path.join(out_dir, 'render.js')
    with open(render, 'w') as f:
        f.write(RENDER)
    subprocess.run(['node', render, jobs_file, out_dir], check=True)
    os.remove(jobs_file)
    os.remove(render)
    with open(os.path.join(out_dir, 'preview.html'), 'w') as f:
        f.write('<!doctype html><body style="margin:0;font:14px sans-serif">' + ''.join(
            '<div style="background:%s;padding:24px"><img src="burn_banner_%s_2x.png" '
            'width="%d"></div>' % ('#ffffff' if t == 'light' else '#2a2b31', t, WIDTH)
            for t in THEMES) + '</body>')
    if install_dir:
        for (name, theme), target in INSTALL.items():
            for scale, folder in ((1, 'default_100_percent'), (2, 'default_200_percent')):
                dest = os.path.join(install_dir, 'chrome/app/theme', folder, target)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copyfile(
                    os.path.join(out_dir, '%s_%s_%dx.png' % (name, theme, scale)), dest)
        print('Installed %d pictures into %s' % (2 * len(INSTALL), install_dir))
    print('Wrote the pictures to %s' % out_dir)


if __name__ == '__main__':
    main()
