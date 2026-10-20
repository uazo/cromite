#!/usr/bin/env python3
# Copyright 2026 The CromIKO Authors
# License: GPL-3.0-only - https://spdx.org/licenses/GPL-3.0-only.html
"""Draws the Linux icons of CromIKO (CromIKO-Linux.patch) from the logo SVG,
like the Windows ones of gen_windows_icons.py: the white mascot on the
charcoal tile.

  chrome/app/theme/chromium/linux/product_logo_{24,48,64,128,256}.png
                     the icons of the windows and of the desktop entry
  chrome/app/theme/default_{100,200}_percent/chromium/linux/product_logo_16.png
                     the small logo of the browser UI on Linux

Usage (needs Node.js with Playwright, and Pillow):

  python3 gen_linux_icons.py cromiko-logo.svg out
  python3 gen_linux_icons.py cromiko-logo.svg out --install ~/chromium/src

The first writes the files into out/; the second also copies them into a
Chromium checkout. pack_linux.py takes the icons of the desktop entry from the
build folder of Chromium.
"""
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gen_icons import load_paths  # noqa: E402
from gen_windows_icons import RENDER, app_icon  # noqa: E402

LINUX = 'chrome/app/theme/chromium/linux/'
SIZES = [24, 48, 64, 128, 256]


def jobs(P):
    out = []
    for size in SIZES:
        out.append({'out': LINUX + 'product_logo_%d.png' % size, 'width': size, 'height': size,
                    'svg': app_icon(P, size)})
    for scale, folder in ((1, 'default_100_percent'), (2, 'default_200_percent')):
        px = 16 * scale
        out.append({'out': 'chrome/app/theme/%s/chromium/linux/product_logo_16.png' % folder,
                    'width': px, 'height': px, 'svg': app_icon(P, px)})
    return out


def main():
    from PIL import Image

    args = sys.argv[1:]
    install_dir = None
    if '--install' in args:
        i = args.index('--install')
        install_dir = args[i + 1]
        args = args[:i] + args[i + 2:]
    svg_path, out_dir = args
    all_jobs = jobs(load_paths(svg_path))
    os.makedirs(out_dir, exist_ok=True)
    json.dump(all_jobs, open(os.path.join(out_dir, 'jobs.json'), 'w'))
    render = os.path.join(out_dir, 'render.js')
    open(render, 'w').write(RENDER)
    subprocess.run(['node', render, os.path.join(out_dir, 'jobs.json'), out_dir], check=True)
    os.remove(os.path.join(out_dir, 'jobs.json'))
    os.remove(render)
    files = [j['out'] for j in all_jobs]
    for f in files:
        path = os.path.join(out_dir, f)
        Image.open(path).convert('RGBA').save(path, optimize=True)
    if install_dir:
        for f in files:
            dest = os.path.join(install_dir, f)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy(os.path.join(out_dir, f), dest)
        print('Installed %d files into %s' % (len(files), install_dir))
    print('Wrote %s' % out_dir)


if __name__ == '__main__':
    main()
