#!/usr/bin/env python3
# Copyright 2026 The CromIKO Authors
# License: GPL-3.0-only - https://spdx.org/licenses/GPL-3.0-only.html
"""Packs CromIKO for Windows as a zip with a CromIKO folder: chrome.exe and
everything it needs next to it, so it runs from wherever the folder is
unpacked.

The files are the ones of Chromium's installer
(chrome/installer/mini_installer/chrome.release): its general files, the
200% resources, ffmpeg, the V8 snapshot and the DirectX compiler, the ones
that the build made. Like Cromite's zip, the files are next to chrome.exe
instead of in a version folder.

Usage: pack_windows.py <build dir> <chrome.release> <out.zip>
"""
import configparser
import glob
import os
import sys
import zipfile

SECTIONS = ['GENERAL', 'HIDPI', 'FFMPEG', 'SNAPSHOTBLOB', 'DXC']
# Without these, CromIKO does not start.
REQUIRED = ['chrome.exe', 'chrome.dll', 'chrome_elf.dll', 'resources.pak', 'icudtl.dat',
            'chrome_100_percent.pak']
FOLDER = 'CromIKO'


def main(build_dir, release_file, zip_path):
    release = configparser.ConfigParser(delimiters=(':',), interpolation=None, strict=False)
    release.optionxform = str
    release.read(release_file)
    files = set()
    for section in SECTIONS:
        if not release.has_section(section):
            continue
        for pattern in release.options(section):
            matches = glob.glob(os.path.join(build_dir, pattern.replace('\\', '/')))
            files.update(os.path.relpath(m, build_dir) for m in matches if os.path.isfile(m))
    missing = [f for f in REQUIRED if f not in files]
    if missing:
        sys.exit('Not in %s: %s' % (build_dir, ', '.join(missing)))
    if not any(f.startswith('locales' + os.sep) for f in files):
        sys.exit('No locales in %s' % build_dir)
    tmp = zip_path + '.part'
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(files):
            z.write(os.path.join(build_dir, f), FOLDER + '/' + f.replace(os.sep, '/'))
    os.replace(tmp, zip_path)
    size = sum(os.path.getsize(os.path.join(build_dir, f)) for f in files)
    print('Packed %d files (%d MB) into %s' % (len(files), size // (1 << 20), zip_path))


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
