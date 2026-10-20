#!/usr/bin/env python3
# Copyright 2026 The CromIKO Authors
# License: GPL-3.0-only - https://spdx.org/licenses/GPL-3.0-only.html
"""Packs CromIKO for Linux as a .tar.xz with a cromiko folder: the browser and
everything it needs, a "cromiko" launcher, and install.sh, which adds CromIKO
to the apps of the desktop for the user (the desktop entry and the icons).

The files are the ones that Chromium's Linux packages install
(chrome/installer/linux/common/installer.include), like Cromite's
chrome-lin64.tar.gz: the browser, its resources and locales, the sandbox
helper (as chrome-sandbox, the name the browser looks for), the graphics
libraries and the Qt shims. The icons come from the CromIKO logos of the
Chromium checkout (CromIKO-Linux.patch, gen_linux_icons.py).

Usage: pack_linux.py <Chromium src dir> <build dir> <out.tar.xz>
"""
import glob
import io
import os
import sys
import tarfile

FOLDER = 'cromiko'
# Without these, CromIKO does not start.
REQUIRED = ['chrome', 'chrome_crashpad_handler', 'resources.pak', 'chrome_100_percent.pak',
            'icudtl.dat']
OPTIONAL = ['chrome_200_percent.pak', 'snapshot_blob.bin', 'v8_context_snapshot.bin',
            'libEGL.so', 'libGLESv2.so', 'libvk_swiftshader.so', 'vk_swiftshader_icd.json',
            'libvulkan.so.1', 'libqt5_shim.so', 'libqt6_shim.so', 'xdg-mime', 'xdg-settings',
            'MEIPreload/manifest.json', 'MEIPreload/preloaded_data.pb']
# The build names the setuid sandbox helper chrome_sandbox; the browser looks
# for chrome-sandbox next to it.
RENAMED = {'chrome_sandbox': 'chrome-sandbox'}
ICON_SIZES = [24, 48, 64, 128, 256]
ICONS = 'chrome/app/theme/chromium/linux/product_logo_%d.png'

LAUNCHER = '''#!/bin/sh
# Starts CromIKO from the folder of this script.
here=$(dirname "$(readlink -f "$0")")
# The command that CromIKO puts in shortcuts and in the default browser setting.
export CHROME_WRAPPER="$here/cromiko"
exec "$here/chrome" "$@"
'''

DESKTOP = '''[Desktop Entry]
Version=1.0
Name=CromIKO
GenericName=Web Browser
Comment=Browse the web with ads blocked and CromIKO DNS
Exec=@CROMIKO@ %U
StartupNotify=true
StartupWMClass=cromiko
Terminal=false
Icon=cromiko
Type=Application
Categories=Network;WebBrowser;
MimeType=application/pdf;application/xhtml+xml;text/html;text/xml;x-scheme-handler/http;x-scheme-handler/https;
Actions=new-window;new-private-window;

[Desktop Action new-window]
Name=New window
Exec=@CROMIKO@

[Desktop Action new-private-window]
Name=New Incognito window
Exec=@CROMIKO@ --incognito
'''

INSTALL = '''#!/bin/sh
# Adds CromIKO to the apps of the desktop, for this user: the desktop entry and
# the icons. Run it again after moving the cromiko folder; --remove takes them
# away again.
set -e
here=$(dirname "$(readlink -f "$0")")
data=${XDG_DATA_HOME:-$HOME/.local/share}
apps=$data/applications
icons=$data/icons/hicolor
if [ "${1:-}" = --remove ]; then
  rm -f "$apps/cromiko.desktop"
  for size in %(sizes)s; do rm -f "$icons/${size}x${size}/apps/cromiko.png"; done
  echo "CromIKO is no longer in your apps. Your profile stays in ~/.config/cromiko."
  exit 0
fi
for size in %(sizes)s; do
  mkdir -p "$icons/${size}x${size}/apps"
  cp "$here/icons/cromiko_$size.png" "$icons/${size}x${size}/apps/cromiko.png"
done
mkdir -p "$apps"
sed "s|@CROMIKO@|$here/cromiko|g" "$here/cromiko.desktop" > "$apps/cromiko.desktop"
update-desktop-database "$apps" > /dev/null 2>&1 || true
gtk-update-icon-cache -q -t "$icons" > /dev/null 2>&1 || true
echo "CromIKO is in your apps now."

# The sandbox of the pages needs user namespaces. Some systems (Ubuntu 23.10
# and newer among them) only allow them to apps they know, and then the
# browser needs chrome-sandbox, owned by root with the setuid bit.
restricted=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo 0)
allowed=$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo 1)
if [ "$restricted" = 1 ] || [ "$allowed" = 0 ]; then
  if [ "$(stat -c %%u:%%a "$here/chrome-sandbox")" != 0:4755 ]; then
    echo
    echo "This system limits the sandbox of the pages. Run this once, to let CromIKO use its own:"
    echo "  sudo chown root:root '$here/chrome-sandbox' && sudo chmod 4755 '$here/chrome-sandbox'"
  fi
fi
''' % {'sizes': ' '.join(str(s) for s in ICON_SIZES)}

README = '''CromIKO for Linux (64-bit)

Start CromIKO with ./cromiko in this folder. To have it in the apps of your
desktop, with its icon, run ./install.sh once (and again after moving the
folder). It keeps its profile in ~/.config/cromiko, so it runs next to
Chromium and Cromite.

If CromIKO says that no usable sandbox was found, run what install.sh shows,
or start it once with --no-sandbox only to look around.
'''


def main(src_dir, build_dir, out_path):
    files = {}
    for name in REQUIRED + OPTIONAL + glob.glob('locales/*.pak', root_dir=build_dir):
        if os.path.isfile(os.path.join(build_dir, name)):
            files[name] = os.path.join(build_dir, name)
    for name, packed in RENAMED.items():
        if os.path.isfile(os.path.join(build_dir, name)):
            files[packed] = os.path.join(build_dir, name)
    missing = [f for f in REQUIRED if f not in files]
    if missing:
        sys.exit('Not in %s: %s' % (build_dir, ', '.join(missing)))
    if not any(f.startswith('locales/') for f in files):
        sys.exit('No locales in %s' % build_dir)
    for size in ICON_SIZES:
        icon = os.path.join(src_dir, ICONS % size)
        if not os.path.isfile(icon):
            sys.exit('No icon %s' % icon)
        files['icons/cromiko_%d.png' % size] = icon

    texts = {'cromiko': (LAUNCHER, 0o755), 'install.sh': (INSTALL, 0o755),
             'cromiko.desktop': (DESKTOP, 0o644), 'README.txt': (README, 0o644)}
    tmp = out_path + '.part'
    with tarfile.open(tmp, 'w:xz', preset=6) as tar:
        for name, (text, mode) in sorted(texts.items()):
            data = text.encode()
            info = tarfile.TarInfo(FOLDER + '/' + name)
            info.size, info.mode = len(data), mode
            tar.addfile(info, io.BytesIO(data))
        for name in sorted(files):
            info = tar.gettarinfo(files[name], FOLDER + '/' + name)
            info.uid = info.gid = 0
            info.uname = info.gname = ''
            # The browser and its helpers are programs; the setuid bit can't be kept in an
            # archive that a user unpacks (see install.sh).
            info.mode = 0o755 if os.access(files[name], os.X_OK) else 0o644
            with open(files[name], 'rb') as f:
                tar.addfile(info, f)
    os.replace(tmp, out_path)
    size = sum(os.path.getsize(p) for p in files.values())
    print('Packed %d files (%d MB) into %s' % (len(files) + len(texts), size // (1 << 20), out_path))


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
