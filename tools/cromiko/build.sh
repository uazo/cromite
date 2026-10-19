#!/bin/bash
# Builds CromIKO: the Android APK of the GitHub releases, the Android App
# Bundle for Google Play, or the Windows version.
#
# Fetches Chromium at the version in build/RELEASE, applies every patch in
# build/cromite_patches_list.txt (Cromite's and CromIKO's), and builds
# chrome_public_apk with build/cromite.gn_args + build/cromiko.gn_args. The
# Google Play version also gets the patches of
# build/cromiko_play_patches_list.txt and is built as chrome_public_bundle,
# with an APK of that bundle to try it on a phone (an .aab can't be installed).
# The Windows version is cross-compiled here, on Linux, like Cromite's: with
# Microsoft's compiler tools and Windows SDK, downloaded by msvc-wine, and
# packed as a zip of the browser folder.
# The steps follow Cromite's own build images (tools/images/chr-source,
# tools/images/cromite-source and tools/images/win-sdk).
#
# Usage: tools/cromiko/build.sh [arm64|arm|x64]     (Android, default: arm64)
#        CROMIKO_FLAVOR=windows CROMIKO_ACCEPT_MSVC_LICENSE=1 tools/cromiko/build.sh
#                                                   (Windows, 64-bit)
#
# Environment, all optional:
#   CROMIKO_WORKDIR        Chromium checkout and build output
#                          (default: $HOME/cromiko-build). It is reused by
#                          later runs, which then skip the download.
#   CROMIKO_DIST           where the finished APK or App Bundle is copied
#                          (default: $CROMIKO_WORKDIR/dist)
#   CROMIKO_FLAVOR         github (default): the APK of the GitHub releases.
#                          play: the App Bundle (.aab) to upload to Google Play.
#                          windows: the zip of CromIKO for Windows (x64).
#   CROMIKO_ACCEPT_MSVC_LICENSE=1
#                          for windows: accept the license terms of the Visual
#                          Studio Build Tools and of the Windows SDK, which the
#                          Windows build downloads from Microsoft (see
#                          docs/BUILD_CROMIKO.md)
#   CROMIKO_PLAY_RELEASE   for play: the number of this upload for the Chromium
#                          version in build/RELEASE, 0 to 9 (default 0). Google
#                          Play needs a higher version code for every upload:
#                          raise it by one for each CromIKO update that keeps the
#                          Chromium version, and start at 0 again with a new one.
#   CROMIKO_INSTALL_DEPS=1 install Chromium's build dependencies (needs sudo)
#   CROMIKO_KEYSTORE_PATH, CROMIKO_KEYSTORE_ALIAS, CROMIKO_KEYSTORE_PASSWORD
#                          release signing key; see docs/BUILD_CROMIKO.md
#   CROMITE_PREF_HASH_SEED_BIN
#                          seed for the settings integrity check
#   CROMIKO_SKIP_DISK_CHECK=1
#                          start even with less free disk than recommended

set -euo pipefail

FLAVOR=${CROMIKO_FLAVOR:-github}
case "$FLAVOR" in
  github|play) TARGET_OS=android; TARGET_CPU=${1:-arm64} ;;
  windows) TARGET_OS=win; TARGET_CPU=${1:-x64} ;;
  *) echo "Unknown CROMIKO_FLAVOR '$FLAVOR' (use github, play or windows)" >&2; exit 2 ;;
esac
case "$TARGET_OS-$TARGET_CPU" in
  android-arm64|android-arm|android-x64|win-x64) ;;
  android-*) echo "Unknown target CPU '$TARGET_CPU' (use arm64, arm or x64)" >&2; exit 2 ;;
  *) echo "The Windows version is built for x64 only, not '$TARGET_CPU'" >&2; exit 2 ;;
esac
if [ "$FLAVOR" = windows ] && [ "${CROMIKO_ACCEPT_MSVC_LICENSE:-0}" != 1 ]; then
  echo "The Windows build downloads Microsoft's Visual Studio Build Tools and Windows SDK." >&2
  echo "Set CROMIKO_ACCEPT_MSVC_LICENSE=1 to accept their license terms (see docs/BUILD_CROMIKO.md)." >&2
  exit 2
fi
PLAY_RELEASE=${CROMIKO_PLAY_RELEASE:-0}
case "$PLAY_RELEASE" in
  [0-9]) ;;
  *) echo "CROMIKO_PLAY_RELEASE must be a number from 0 to 9, not '$PLAY_RELEASE'" >&2; exit 2 ;;
esac

REPO_DIR=$(cd "$(dirname "$0")/../.." && pwd)
VERSION=$(tr -d '[:space:]' < "$REPO_DIR/build/RELEASE")
WORKDIR=${CROMIKO_WORKDIR:-$HOME/cromiko-build}
DIST=${CROMIKO_DIST:-$WORKDIR/dist}
SRC=$WORKDIR/chromium/src
if [ "$TARGET_OS" = win ]; then OUT=out/win64; else OUT=out/$TARGET_CPU; fi
STAMP=$WORKDIR/.chromium-version
# The platforms that the Chromium download has the files of, like "android win".
TARGETS_STAMP=$WORKDIR/.chromium-targets
CHR_SOURCE=https://chromium.googlesource.com/chromium/src.git
# The Windows build tools, from msvc-wine at this commit (see prepare_windows_sdk).
MSVC_WINE=https://github.com/mstorsjo/msvc-wine.git
MSVC_WINE_COMMIT=514f8ea34842cd6d831804d0e9658d3a32870ae1

step() {
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::endgroup::"
    echo "::group::$*"
  else
    echo -e "\n==== $*"
  fi
}
trap 'if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::endgroup::"; fi' EXIT

fail() {
  if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::error::$*"; else echo "ERROR: $*" >&2; fi
  exit 1
}

# The compiler tools and the SDK for Windows, like the Visual Studio 2026 toolchain that
# Chromium expects (build/vs_toolchain.py): MSVC 14.50 and the Windows SDK 10.0.28000,
# downloaded from Microsoft by msvc-wine (tools/images/win-sdk of Cromite does the same).
# Windows file names are not case-sensitive, and the sources include them with any case,
# so they go into a folder without case on an image file with the casefold feature.
prepare_windows_sdk() {
  local image=$WORKDIR/win_sdk.img root=$WORKDIR/win_sdk
  local sdk=$root/casefold/vs2026-sdk28000
  if ! mountpoint -q "$root"; then
    if [ ! -f "$image" ]; then
      step "Making a folder without case for the Windows SDK"
      truncate -s 40G "$image"
      sudo mkfs.ext4 -q -F -O casefold "$image"
    fi
    mkdir -p "$root"
    sudo mount -o loop "$image" "$root" \
      || fail "Could not mount $image (a kernel with ext4 casefold support is needed)."
  fi
  if [ ! -d "$root/casefold" ]; then
    sudo mkdir "$root/casefold"
    sudo chattr +F "$root/casefold"
    sudo chown "$(id -u):$(id -g)" "$root/casefold"
  fi
  if [ ! -f "$sdk/.cromiko-ready" ]; then
    step "Downloading the Visual Studio Build Tools and the Windows SDK (about 1 GB)"
    if ! command -v msiextract > /dev/null; then
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q msitools
    fi
    if [ ! -d "$WORKDIR/msvc-wine/.git" ]; then
      git clone -q "$MSVC_WINE" "$WORKDIR/msvc-wine"
    fi
    git -C "$WORKDIR/msvc-wine" fetch -q origin
    git -C "$WORKDIR/msvc-wine" checkout -q "$MSVC_WINE_COMMIT"
    rm -rf "$sdk"
    python3 "$WORKDIR/msvc-wine/vsdownload.py" --accept-license --major 18 \
      --msvc-version 18.0 --sdk-version 10.0.28000 --architecture x86 x64 \
      --with-asan=no --with-msbuild=no --cache "$WORKDIR/msvc-cache" --dest "$sdk"
    [ -d "$sdk/Windows Kits/10/Include/10.0.28000.0" ] \
      || fail "The Windows SDK download has no SDK 10.0.28000.0."
    rm -rf "$WORKDIR/msvc-cache"
    touch "$sdk/.cromiko-ready"
  fi
  # Visual Studio also installs a servicing file of its newest MSVC next to the one of
  # --msvc-version: VC/Tools/MSVC/14.51.* with only an Auxiliary folder. gen-setenv.py
  # takes the first MSVC folder it finds, so only the one with the compiler may stay.
  local msvc
  for msvc in "$sdk"/VC/Tools/MSVC/*/; do
    if [ -d "$msvc" ] && [ ! -d "$msvc/include" ]; then
      echo "Removing ${msvc%/}: it has no compiler, only a servicing file"
      rm -rf "$msvc"
    fi
  done
  [ "$(find "$sdk/VC/Tools/MSVC" -mindepth 1 -maxdepth 1 -type d | wc -l)" = 1 ] \
    || fail "Not exactly one MSVC in $sdk/VC/Tools/MSVC. Delete $sdk/.cromiko-ready to download it again."
  # The SetEnv files that Chromium reads the paths of the toolchain from. They are made on
  # every build, so a download made before a fix here is repaired without downloading it
  # again. Chromium stops when a folder of INCLUDE or LIB is missing; check that here, with
  # a clearer message.
  python3 "$REPO_DIR/tools/images/win-sdk/gen-setenv.py" "$sdk"
  python3 - "$sdk" <<'EOF' || fail "The Windows SDK in $sdk is not complete. Delete $sdk/.cromiko-ready to download it again."
import json, os, sys
sdk = sys.argv[1]
missing = []
for cpu in ('x86', 'x64'):
    with open(os.path.join(sdk, 'Windows Kits', '10', 'bin', 'SetEnv.%s.json' % cpu)) as f:
        env = json.load(f)['env']
    for var in ('INCLUDE', 'LIB'):
        missing += [os.path.join(*parts) for parts in env[var]
                    if not os.path.isdir(os.path.join(sdk, *parts))]
for path in sorted(set(missing)):
    print('Missing in the Windows SDK: ' + path)
sys.exit(1 if missing else 0)
EOF
  export DEPOT_TOOLS_WIN_TOOLCHAIN_BASE_URL="$sdk/"
  export WINDOWSSDKDIR="$sdk/Windows Kits/10/"
  export GYP_MSVS_OVERRIDE_PATH="$sdk/"
  echo "Windows SDK: $sdk"
}

mkdir -p "$WORKDIR" "$DIST"
cd "$WORKDIR"

step "Checking the machine"
case "$FLAVOR" in
  play) echo "CromIKO for Google Play, Chromium $VERSION, target $TARGET_CPU" ;;
  windows) echo "CromIKO for Windows, Chromium $VERSION, target $TARGET_CPU" ;;
  *) echo "CromIKO for GitHub, Chromium $VERSION, target $TARGET_CPU" ;;
esac
echo "CromIKO $(git -C "$REPO_DIR" log -1 --format='%h (%cs) %s' 2>/dev/null || echo '(not a git checkout)')," \
  "$(grep -c '^CromIKO-.*\.patch$' "$REPO_DIR/build/cromite_patches_list.txt") CromIKO patches"
echo "CPU cores: $(nproc), memory: $(free -g | awk '/^Mem:/ {print $2}') GB"
free_gb=$(df -BG --output=avail "$WORKDIR" | tail -1 | tr -dc '0-9')
echo "Free disk in $WORKDIR: ${free_gb} GB"

# The Chromium download has the files of the platforms it was made for. A Windows build on
# a download without them downloads Chromium again, with both.
targets="android"
if [ "$TARGET_OS" = win ] || grep -qw win "$TARGETS_STAMP" 2>/dev/null; then
  targets="android win"
fi
if [ -f "$STAMP" ] && [ "$(cat "$TARGETS_STAMP" 2>/dev/null || echo android)" != "$targets" ]; then
  echo "The Chromium download has no Windows files yet: downloading it again with them."
  rm -rf "$WORKDIR/chromium" "$STAMP"
  free_gb=$(df -BG --output=avail "$WORKDIR" | tail -1 | tr -dc '0-9')
fi

if [ "$(cat "$STAMP" 2>/dev/null)" != "$VERSION" ] && [ "$free_gb" -lt 150 ] \
    && [ "${CROMIKO_SKIP_DISK_CHECK:-0}" != 1 ]; then
  fail "A first build needs about 150 GB of free disk (${free_gb} GB available). See docs/BUILD_CROMIKO.md."
fi

if [ "${CROMIKO_INSTALL_DEPS:-0}" = 1 ]; then
  step "Installing build dependencies"
  # Chromium's own script: from the Chromium download when it is there, else from
  # Chromium's server, which sometimes answers "503" for a while.
  deps_dir=$WORKDIR/chromium/src/build
  if [ "$(cat "$STAMP" 2>/dev/null)" != "$VERSION" ] || [ ! -x "$deps_dir/install-build-deps.sh" ]; then
    deps_dir=$WORKDIR
    for f in install-build-deps.sh install-build-deps.py; do
      curl -fsSL --retry 6 --retry-delay 20 \
        "$CHR_SOURCE/+/refs/tags/$VERSION/build/$f?format=TEXT" | base64 -d > "$WORKDIR/$f"
      chmod +x "$WORKDIR/$f"
    done
  fi
  sudo DEBIAN_FRONTEND=noninteractive "$deps_dir/install-build-deps.sh" \
    --android --lib32 --no-prompt --no-chromeos-fonts
fi

step "Preparing depot_tools"
if [ ! -d depot_tools ]; then
  git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
else
  git -C depot_tools pull -q --ff-only || echo "depot_tools update failed, using the existing copy"
fi
export PATH="$WORKDIR/depot_tools:$PATH"
# The first gclient call bootstraps depot_tools' own Python and tools.
gclient --version
export DEPOT_TOOLS_UPDATE=0

if [ "$(cat "$STAMP" 2>/dev/null)" != "$VERSION" ]; then
  step "Downloading Chromium $VERSION (first run for this version, this takes a while)"
  rm -rf "$WORKDIR/chromium" "$STAMP" "$TARGETS_STAMP"
  mkdir -p "$SRC"
  cd "$SRC"
  git init -q
  git remote add origin "$CHR_SOURCE"
  git config --unset-all remote.origin.fetch || true
  git config --add remote.origin.fetch "+refs/tags/$VERSION:refs/tags/$VERSION"
  git fetch --depth 2 origin "+refs/tags/$VERSION:refs/tags/$VERSION"
  git checkout -q "$VERSION"
  VERSION_SHA=$(git rev-parse HEAD)

  # Like Cromite's: the Windows files are left out except what the build needs (the
  # DirectX headers), and the hooks that need Google's own Windows toolchain are skipped.
  gclient_targets=$(printf '"%s", ' $targets)
  cat > ../.gclient <<EOF
solutions = [
  { "name"        : "src",
    "url"         : "$CHR_SOURCE@$VERSION_SHA",
    "deps_file"   : "DEPS",
    "managed"     : False,
    "custom_deps" : {
        "src/third_party/apache-windows-arm64": None,
        "src/third_party/updater/chrome_win_x86": None,
        "src/third_party/updater/chrome_win_x86_64": None,
        "src/third_party/updater/chromium_win_x86": None,
        "src/third_party/updater/chromium_win_x86_64": None,
        "src/third_party/gperf": None,
        "src/third_party/lighttpd": None,
        "src/third_party/lzma_sdk/bin/host_platform": None,
        "src/third_party/lzma_sdk/bin/win64": None,
        "src/third_party/perl": None,
        "src/tools/skia_goldctl/win": None,
        "src/third_party/screen-ai/windows_amd64": None,
        "src/third_party/screen-ai/windows_386": None,
        "src/third_party/cronet_android_mainline_clang/linux-amd64": None,
        "src/testing/libfuzzer/fuzzers/wasm_corpus": None,
    },
    "custom_hooks" : [
        { "name": "ciopfs_linux", "pattern": ".", "action": ["echo", "ciopfs_linux hook override"] },
        { "name": "win_toolchain", "pattern": ".", "action": ["echo", "win_toolchain hook override"] },
        { "name": "rc_win", "pattern": ".", "action": ["echo", "rc_win hook override"] },
        { "name": "rc_linux", "pattern": ".", "action": ["echo", "rc_linux hook override"] },
        { "name": "apache_win32", "pattern": ".", "action": ["echo", "apache_win32 hook override"] },
    ],
    "custom_vars": {
       "checkout_android_prebuilts_build_tools": True,
       "checkout_telemetry_dependencies": False,
       "checkout_pgo_profiles": True,
    },
  },
]
target_os = [${gclient_targets%, }]
EOF

  gclient sync -D --no-history --nohooks
  git config user.email "cromiko-build@users.noreply.github.com"
  git config user.name "CromIKO build"
  gclient runhooks
  rm -rf third_party/angle/third_party/VK-GL-CTS/

  if [[ " $targets " == *" win "* ]]; then
    step "Getting the tools for building Windows on Linux"
    # The resource compiler for Linux (its hook is skipped above, like in Cromite) and the
    # profile of the optimization of the Windows build. The Windows runtime of clang comes
    # with the download, because target_os has "win".
    python3 third_party/depot_tools/download_from_google_storage.py --no_resume \
      --bucket chromium-browser-clang/rc -s build/toolchain/win/rc/linux64/rc.sha1
    python3 tools/update_pgo_profiles.py --target=win64 update \
      --gs-url-base=chromium-optimization-profiles/pgo_profiles
  fi

  step "Merging sub-repositories that the patches touch"
  # Same as tools/images/cromite-source/apply-cromite-patches.sh: these are
  # separate git checkouts, so they are folded into the main repository to
  # let `git am` patch them.
  for sub in v8 third_party/devtools-frontend third_party/skia third_party/perfetto \
      third_party/boringssl/src; do
    gitdir=$sub/.git
    [ "$sub" = third_party/devtools-frontend ] && gitdir=$sub/src/.git
    rm -rf "$gitdir"
    cp -r "$sub" "$sub-bis"
    git rm -rqf "$sub" || true
    git submodule deinit -f "$sub" || true
    rm -rf "$sub"
    mv "$sub-bis" "$sub"
    git add -f "$sub" > /dev/null
    git commit -qm ":NOEXPORT: $sub repo" > /dev/null
  done
  git prune

  (cd third_party/devtools-frontend/src && vpython3 scripts/deps/sync_rollup_libs.py)

  git tag -f cromiko-base > /dev/null
  echo "$VERSION" > "$STAMP"
  echo "$targets" > "$TARGETS_STAMP"
fi

step "Applying patches"
cd "$SRC"
git config user.email "cromiko-build@users.noreply.github.com"
git config user.name "CromIKO build"
git am --abort > /dev/null 2>&1 || true
mapfile -t patches < <(grep -v '^#' "$REPO_DIR/build/cromite_patches_list.txt" | grep '\.patch$')
if [ "$FLAVOR" = play ]; then
  # The Google Play version gets its own patches on top. Switching versions on the same
  # machine works like any other change of the list: the patches that differ are redone.
  mapfile -t -O "${#patches[@]}" patches \
    < <(grep -v '^#' "$REPO_DIR/build/cromiko_play_patches_list.txt" | grep '\.patch$')
fi
# Patches that are already applied unchanged (same name, same changes) stay in place, so that
# their files keep their timestamps and the build only recompiles what the other patches touch.
base=cromiko-base
keep=0
while read -r commit; do
  [ "$keep" -lt "${#patches[@]}" ] || break
  patch=${patches[$keep]}
  git log -1 --format=%B "$commit" | grep -qx "FILE:$patch" || break
  [ "$(git show --binary "$commit" | git patch-id --stable | cut -d' ' -f1)" = \
    "$(git patch-id --stable < "$REPO_DIR/build/patches/$patch" | cut -d' ' -f1)" ] || break
  base=$commit
  keep=$((keep + 1))
done < <(git rev-list --reverse cromiko-base..HEAD)
git reset -q --hard "$base"
echo "$keep patches already applied, applying $(( ${#patches[@]} - keep ))"
for patch in "${patches[@]:$keep}"; do
  sed "0,/^---/s//FILE:$patch\n---/" "$REPO_DIR/build/patches/$patch" | git am -q \
    || fail "Patch $patch does not apply to Chromium $VERSION"
done
echo "All ${#patches[@]} patches applied"
# Cromite includes all .grdp files of a folder in a .grd file through the folder's placeholder.txt,
# which the build does not track: a repeat build would not compile a new or changed .grdp file.
# Touch the .grd file in that case.
while read -r placeholder; do
  dir=$(dirname "$placeholder")
  mapfile -t grds < <(git grep -l -F "$(basename "$dir")/placeholder.txt" -- '*.grd' '*.grdp')
  for grd in "${grds[@]}"; do
    if [ -n "$(find "$dir" -name '*.grdp' -newer "$grd" -print -quit)" ]; then
      echo "Strings changed in $dir, rebuilding $grd"
      touch "$grd"
    fi
  done
done < <(git ls-files '*/placeholder.txt')

if [ "$TARGET_OS" = win ]; then
  prepare_windows_sdk
fi

step "Configuring the build"
GN_ARGS="target_os=\"$TARGET_OS\" $(cat "$REPO_DIR/build/cromite.gn_args") target_cpu=\"$TARGET_CPU\" $(cat "$REPO_DIR/build/cromiko.gn_args")"
gn gen "$OUT" --args="$GN_ARGS"
if [ "$FLAVOR" = play ]; then
  # Google Play needs a higher version code for every upload. Chromium's is
  # {build}{3 digits: patch}{1 digit: package}{1 digit: ABIs}, with package 0 for this
  # app: the Google Play version puts the number of the upload there instead.
  chromium_code=$(sed -n 's/^Chrome: //p' "$OUT/android_chrome_versions.txt")
  [ -n "$chromium_code" ] || fail "No version code of Chromium in $OUT/android_chrome_versions.txt"
  play_code=$(( chromium_code / 100 * 100 + PLAY_RELEASE * 10 + chromium_code % 10 ))
  echo "Version code for Google Play: $play_code (upload $PLAY_RELEASE of Chromium $VERSION)"
  gn gen "$OUT" --args="$GN_ARGS android_override_version_code=\"$play_code\""
  if [ -z "${CROMIKO_KEYSTORE_PATH:-}" ]; then
    echo "WARNING: no CROMIKO_KEYSTORE_PATH, so the App Bundle is signed with Chromium's public"
    echo "debug key. Google Play does not accept that: sign it with your own key to upload it."
  fi
fi
gn args "$OUT" --list --short

step "Building (several hours on a first build)"
case "$FLAVOR" in
  play) python3 "$WORKDIR/depot_tools/siso.py" ninja -C "$OUT" chrome_public_bundle --offline ;;
  windows) python3 "$WORKDIR/depot_tools/siso.py" ninja -C "$OUT" chrome --offline ;;
  *) python3 "$WORKDIR/depot_tools/siso.py" ninja -C "$OUT" chrome_public_apk --offline ;;
esac

if [ "$FLAVOR" = play ]; then
  step "Collecting the App Bundle"
  AAB=$DIST/CromIKO-$VERSION-$TARGET_CPU-play.aab
  cp "$OUT/apks/ChromePublic.aab" "$AAB"
  if [ -f "$OUT/apks/ChromePublic.aab.mapping" ]; then
    cp "$OUT/apks/ChromePublic.aab.mapping" "$AAB.mapping"
  fi
  echo "App Bundle for Google Play: $AAB"

  # An .aab is only for the Play Console; phones can't install it. In the bundle, the
  # browser and all of CromIKO are in a split of their own ("chrome"), so tools that take
  # only the base of an .aab make a broken app. This APK has all of the bundle in one file,
  # signed like the bundle, to try the Google Play version first.
  step "Making an APK of the App Bundle, to try it on a phone"
  APKS=$WORKDIR/play-test.apks
  TEST_APK=$DIST/CromIKO-$VERSION-$TARGET_CPU-play-test.apk
  rm -f "$APKS"
  "$SRC/$OUT/bin/chrome_public_bundle" build-bundle-apks --output-apks "$APKS" \
    --build-mode universal
  python3 - "$APKS" "$TEST_APK" <<'EOF'
import shutil, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as apks, apks.open('universal.apk') as src, \
    open(sys.argv[2], 'wb') as dst:
  shutil.copyfileobj(src, dst)
EOF
  rm -f "$APKS"
  echo "APK of the Google Play version, to try it on a phone: $TEST_APK"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "aab=$AAB" >> "$GITHUB_OUTPUT"
    echo "play_test_apk=$TEST_APK" >> "$GITHUB_OUTPUT"
    echo "version=$VERSION" >> "$GITHUB_OUTPUT"
  fi
elif [ "$FLAVOR" = windows ]; then
  step "Packing CromIKO for Windows"
  ZIP=$DIST/CromIKO-$VERSION-win64.zip
  python3 "$REPO_DIR/tools/cromiko/pack_windows.py" "$OUT" \
    chrome/installer/mini_installer/chrome.release "$ZIP"
  echo "CromIKO for Windows: $ZIP"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "zip=$ZIP" >> "$GITHUB_OUTPUT"
    echo "version=$VERSION" >> "$GITHUB_OUTPUT"
  fi
else
  step "Collecting the APK"
  APK=$DIST/CromIKO-$VERSION-$TARGET_CPU.apk
  cp "$OUT/apks/ChromePublic.apk" "$APK"
  if [ -f "$OUT/apks/ChromePublic.apk.mapping" ]; then
    cp "$OUT/apks/ChromePublic.apk.mapping" "$APK.mapping"
  fi
  echo "APK: $APK"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "apk=$APK" >> "$GITHUB_OUTPUT"
    echo "version=$VERSION" >> "$GITHUB_OUTPUT"
  fi
fi
