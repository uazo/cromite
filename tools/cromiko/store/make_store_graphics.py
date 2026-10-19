#!/usr/bin/env python3
# Copyright 2026 The CromIKO Authors
# License: GPL-3.0-only - https://spdx.org/licenses/GPL-3.0-only.html
"""Makes the Google Play graphics of CromIKO, in tools/cromiko/store/en/:

  icon-512.png          the store icon (512 x 512, like the launcher icon)
  feature-graphic.png   the feature graphic (1024 x 500)
  phone-1.png ... 8     the phone screenshots (1080 x 1920)

They are drawn by store.html with the logo (tools/cromiko/cromiko-logo.svg),
the feature icons (tools/cromiko/icons) and the screens of the app; the
player is a capture of the real page script of CromIKO-Video-Player.patch.
The screenshots and the feature graphic are saved without transparency, as
Google Play wants them.

Usage: python3 tools/cromiko/store/make_store_graphics.py
Needs Node.js with Playwright and its Chromium (like the tests in
tools/cromiko), ffmpeg, git and Pillow.
"""
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(TOOLS))
BUILD = os.path.join(HERE, 'build')
OUT = os.path.join(HERE, 'en')
PATCHES = os.path.join(REPO, 'build', 'patches')
VIDEO_SCRIPT = 'chrome/android/java/res/raw/cromiko_video.js'

sys.path.insert(0, TOOLS)
from gen_icons import load_paths  # noqa: E402

PHONE = (1080, 1920)
GRAPHICS = [('icon', 512, 512, 'icon-512.png'), ('feature', 1024, 500, 'feature-graphic.png')] + [
    ('s%d' % n, PHONE[0], PHONE[1], 'phone-%d.png' % n) for n in range(1, 9)]


def icons():
    """The feature icons, in currentColor."""
    out = {}
    folder = os.path.join(TOOLS, 'icons')
    for name in sorted(os.listdir(folder)):
        if name.endswith('_mono.svg'):
            svg = open(os.path.join(folder, name)).read().replace('#1E212A', 'currentColor')
            out[name[:-len('_mono.svg')]] = svg.strip()
    return out


def video_script():
    """cromiko_video.js as CromIKO-Video-Player.patch adds it, with the changes of later patches."""
    lines = open(os.path.join(PATCHES, 'CromIKO-Video-Player.patch')).read().split('\n')
    start = lines.index('+++ b/' + VIDEO_SCRIPT)
    script = []
    for line in lines[start + 2:]:
        if line.startswith('diff --git'):
            break
        if line.startswith('+'):
            script.append(line[1:])
    work = os.path.join(BUILD, 'video-script')
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(os.path.join(work, os.path.dirname(VIDEO_SCRIPT)))
    open(os.path.join(work, VIDEO_SCRIPT), 'w').write('\n'.join(script) + '\n')
    subprocess.run(['git', 'apply', '--include=' + VIDEO_SCRIPT,
                    os.path.join(PATCHES, 'CromIKO-Accent-Color.patch')], cwd=work, check=True)
    return os.path.join(work, VIDEO_SCRIPT)


def node(*args):
    subprocess.run(['node', os.path.join(HERE, 'render.js')] + list(args), check=True)


def main():
    from PIL import Image

    os.makedirs(BUILD, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    dns = open(os.path.join(TOOLS, 'icons', 'dns_mono.svg')).read()
    assets = {
        'logo': load_paths(os.path.join(TOOLS, 'cromiko-logo.svg')),
        'icons': icons(),
        'dnsIcon': re.findall(r' d="([^"]+)"', dns),
        'player': 'player.png',
    }
    html = os.path.join(BUILD, 'store.html')
    template = open(os.path.join(HERE, 'store.html')).read()
    open(html, 'w').write(template.replace('__ASSETS__', json.dumps(assets)))

    print('Video frame and player')
    jobs = os.path.join(BUILD, 'jobs.json')
    json.dump([{'id': 'videoframe', 'width': 1280, 'height': 720,
                'out': os.path.join(BUILD, 'videoframe.png')}], open(jobs, 'w'))
    node('graphics', html, jobs)
    # A 23 minute video of that frame, for the time bar of the player.
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', '1',
                    '-i', os.path.join(BUILD, 'videoframe.png'), '-t', '1398', '-c:v', 'libvpx',
                    '-b:v', '400k', '-deadline', 'realtime', '-cpu-used', '8',
                    os.path.join(BUILD, 'video.webm')], check=True)
    open(os.path.join(BUILD, 'player-site.html'), 'w').write(
        '<!doctype html><html><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Orbit Knights - Episode 7</title>'
        '<style>body{margin:0;background:#000}video{width:100%;display:block}</style></head>'
        '<body><video src="video.webm" playsinline muted preload="auto"></video></body></html>')
    node('player', os.path.join(BUILD, 'player-site.html'), video_script(), os.path.join(BUILD, 'player.png'))

    print('Store graphics')
    json.dump([{'id': id, 'width': w, 'height': h, 'out': os.path.join(OUT, out)}
               for id, w, h, out in GRAPHICS], open(jobs, 'w'))
    node('graphics', html, jobs)
    # Google Play wants the screenshots and the feature graphic without transparency, and the
    # icon as a 32-bit PNG.
    for id, w, h, out in GRAPHICS:
        path = os.path.join(OUT, out)
        image = Image.open(path)
        assert image.size == (w, h), (path, image.size)
        image.convert('RGBA' if id == 'icon' else 'RGB').save(path, optimize=True)
    print('Done: ' + OUT)


if __name__ == '__main__':
    main()
