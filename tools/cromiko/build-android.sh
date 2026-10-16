#!/bin/bash
# Builds the CromIKO Android APK.
#
# Fetches Chromium at the version in build/RELEASE, applies every patch in
# build/cromite_patches_list.txt (Cromite's and CromIKO's), and builds
# chrome_public_apk with build/cromite.gn_args + build/cromiko.gn_args.
# The steps follow Cromite's own build images (tools/images/chr-source and
# tools/images/cromite-source).
#
# Usage: tools/cromiko/build-android.sh [arm64|arm|x64]     (default: arm64)
#
# Environment, all optional:
#   CROMIKO_WORKDIR        Chromium checkout and build output
#                          (default: $HOME/cromiko-build). It is reused by
#                          later runs, which then skip the download.
#   CROMIKO_DIST           where the finished APK is copied
#                          (default: $CROMIKO_WORKDIR/dist)
#   CROMIKO_INSTALL_DEPS=1 install Chromium's build dependencies (needs sudo)
#   CROMIKO_KEYSTORE_PATH, CROMIKO_KEYSTORE_ALIAS, CROMIKO_KEYSTORE_PASSWORD
#                          release signing key; see docs/BUILD_CROMIKO.md
#   CROMITE_PREF_HASH_SEED_BIN
#                          seed for the settings integrity check
#   CROMIKO_SKIP_DISK_CHECK=1
#                          start even with less free disk than recommended

set -euo pipefail

TARGET_CPU=${1:-arm64}
case "$TARGET_CPU" in
  arm64|arm|x64) ;;
  *) echo "Unknown target CPU '$TARGET_CPU' (use arm64, arm or x64)" >&2; exit 2 ;;
esac

REPO_DIR=$(cd "$(dirname "$0")/../.." && pwd)
VERSION=$(tr -d '[:space:]' < "$REPO_DIR/build/RELEASE")
WORKDIR=${CROMIKO_WORKDIR:-$HOME/cromiko-build}
DIST=${CROMIKO_DIST:-$WORKDIR/dist}
SRC=$WORKDIR/chromium/src
OUT=out/$TARGET_CPU
STAMP=$WORKDIR/.chromium-version
CHR_SOURCE=https://chromium.googlesource.com/chromium/src.git

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

mkdir -p "$WORKDIR" "$DIST"
cd "$WORKDIR"

step "Checking the machine"
echo "CromIKO for Chromium $VERSION, target $TARGET_CPU"
echo "CPU cores: $(nproc), memory: $(free -g | awk '/^Mem:/ {print $2}') GB"
free_gb=$(df -BG --output=avail "$WORKDIR" | tail -1 | tr -dc '0-9')
echo "Free disk in $WORKDIR: ${free_gb} GB"
if [ "$(cat "$STAMP" 2>/dev/null)" != "$VERSION" ] && [ "$free_gb" -lt 150 ] \
    && [ "${CROMIKO_SKIP_DISK_CHECK:-0}" != 1 ]; then
  fail "A first build needs about 150 GB of free disk (${free_gb} GB available). See docs/BUILD_CROMIKO.md."
fi

if [ "${CROMIKO_INSTALL_DEPS:-0}" = 1 ]; then
  step "Installing build dependencies"
  for f in install-build-deps.sh install-build-deps.py; do
    curl -fsSL "$CHR_SOURCE/+/refs/tags/$VERSION/build/$f?format=TEXT" | base64 -d > "$WORKDIR/$f"
    chmod +x "$WORKDIR/$f"
  done
  sudo DEBIAN_FRONTEND=noninteractive "$WORKDIR/install-build-deps.sh" \
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
  rm -rf "$WORKDIR/chromium" "$STAMP"
  mkdir -p "$SRC"
  cd "$SRC"
  git init -q
  git remote add origin "$CHR_SOURCE"
  git config --unset-all remote.origin.fetch || true
  git config --add remote.origin.fetch "+refs/tags/$VERSION:refs/tags/$VERSION"
  git fetch --depth 2 origin "+refs/tags/$VERSION:refs/tags/$VERSION"
  git checkout -q "$VERSION"
  VERSION_SHA=$(git rev-parse HEAD)

  cat > ../.gclient <<EOF
solutions = [
  { "name"        : "src",
    "url"         : "$CHR_SOURCE@$VERSION_SHA",
    "deps_file"   : "DEPS",
    "managed"     : False,
    "custom_deps" : {
        "src/third_party/cronet_android_mainline_clang/linux-amd64": None,
        "src/testing/libfuzzer/fuzzers/wasm_corpus": None,
    },
    "custom_hooks" : [
        { "name": "ciopfs_linux", "pattern": ".", "action": ["echo", "ciopfs_linux hook override"] },
        { "name": "rc_linux", "pattern": ".", "action": ["echo", "rc_linux hook override"] },
    ],
    "custom_vars": {
       "checkout_android_prebuilts_build_tools": True,
       "checkout_telemetry_dependencies": False,
       "checkout_pgo_profiles": True,
    },
  },
]
target_os = ["android"]
EOF

  gclient sync -D --no-history --nohooks
  git config user.email "cromiko-build@users.noreply.github.com"
  git config user.name "CromIKO build"
  gclient runhooks
  rm -rf third_party/angle/third_party/VK-GL-CTS/

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
fi

step "Applying patches"
cd "$SRC"
git config user.email "cromiko-build@users.noreply.github.com"
git config user.name "CromIKO build"
git am --abort > /dev/null 2>&1 || true
mapfile -t patches < <(grep -v '^#' "$REPO_DIR/build/cromite_patches_list.txt" | grep '\.patch$')
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

step "Configuring the build"
gn gen "$OUT" --args="target_os=\"android\" $(cat "$REPO_DIR/build/cromite.gn_args") target_cpu=\"$TARGET_CPU\" $(cat "$REPO_DIR/build/cromiko.gn_args")"
gn args "$OUT" --list --short

step "Building (several hours on a first build)"
python3 "$WORKDIR/depot_tools/siso.py" ninja -C "$OUT" chrome_public_apk --offline

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
