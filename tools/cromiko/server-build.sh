#!/bin/bash
# One-command CromIKO build on a fresh server (Debian 12, Ubuntu 22.04/24.04).
#
# Log in to the new server as root and run:
#
#   curl -fsSLO https://raw.githubusercontent.com/PupJune2/cromIKO/master/tools/cromiko/server-build.sh
#   bash server-build.sh            # or: bash server-build.sh arm   (arm64, arm, x64)
#
# First it asks which version to build: the GitHub version (the Android APK
# of the GitHub releases, as always), the Google Play version (an Android App
# Bundle to upload to the Play Console, without the update check and without
# background play on YouTube; see build/cromiko_play_patches_list.txt), the
# Windows version (a zip with CromIKO for Windows 10 and 11, 64-bit), or the
# Linux version (a .tar.xz with CromIKO for Linux, 64-bit).
#
# It installs the basic tools, creates a "builder" user, clones the CromIKO
# repository, and starts tools/cromiko/build.sh in a tmux session, so the
# build keeps running if your SSH connection drops. Running it again updates
# the checkout and builds again, reusing the Chromium download.
#
# Environment, all optional:
#   CROMIKO_FLAVOR   github, play, windows or linux: the version to build,
#                    without asking
#   CROMIKO_PLAY_RELEASE
#                    for play: the number of the upload for this Chromium
#                    version, 0 to 9, without asking (see build.sh)
#   CROMIKO_ACCEPT_MSVC_LICENSE=1
#                    for windows: accept the license terms of Microsoft's
#                    Visual Studio Build Tools and Windows SDK, which the
#                    Windows build downloads, without asking
#   CROMIKO_REPO     repository to build (default: https://github.com/PupJune2/cromIKO)
#   CROMIKO_BRANCH   branch to build (default: the branch of the last build on
#                    this server, or master for the first one)
#   CROMIKO_KEYSTORE_PATH, CROMIKO_KEYSTORE_ALIAS, CROMIKO_KEYSTORE_PASSWORD
#                    release signing key: path of a keystore file on this
#                    server, its alias and password (see docs/BUILD_CROMIKO.md)
#   CROMITE_PREF_HASH_SEED_BIN
#                    seed for the settings integrity check

set -euo pipefail

TARGET_CPU=${1:-arm64}
REPO=${CROMIKO_REPO:-https://github.com/PupJune2/cromIKO}
BUILD_USER=builder
BUILD_HOME=/home/$BUILD_USER
CHECKOUT=$BUILD_HOME/cromIKO
# Without CROMIKO_BRANCH, a build uses the branch of the last one on this server, so that
# building the other version (GitHub or Google Play) builds the same CromIKO.
BRANCH=${CROMIKO_BRANCH:-}
if [ -z "$BRANCH" ] && [ -f "$CHECKOUT/.git/HEAD" ]; then
  BRANCH=$(sed -n 's|^ref: refs/heads/||p' "$CHECKOUT/.git/HEAD")
fi
BRANCH=${BRANCH:-master}
ENV_FILE=$BUILD_HOME/.cromiko-build.env
RUNNER=$BUILD_HOME/run-cromiko-build.sh
SESSION=cromiko
FLAVOR=${CROMIKO_FLAVOR:-}
PLAY_RELEASE=${CROMIKO_PLAY_RELEASE:-}

say() { echo -e "\n==== $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }
# The questions are asked on the terminal, also when this script is piped into bash
# (curl ... | bash), where its input is the script itself.
can_ask() { [ -t 0 ] || ( : < /dev/tty ) 2> /dev/null; }
ask() {
  local input=/dev/tty
  if [ -t 0 ]; then input=/dev/stdin; fi
  # Only what is typed after the question answers it. Some terminals (phone apps among
  # them) send two line ends for Enter or a pasted line, and the second one would answer
  # the question at once, with its default.
  while read -r -t 0.3 _ < "$input"; do :; done
  read -r -p "$1" "$2" < "$input" || true
}
as_builder() { sudo -u "$BUILD_USER" -H "$@"; }
# Whether this script runs inside a tmux window (for example the one of the previous
# build). $TMUX is not reliable here because sudo removes it.
inside_tmux() {
  local pid=$$
  while [ "$pid" -gt 1 ]; do
    case "$(ps -o comm= -p "$pid")" in tmux*) return 0 ;; esac
    pid=$(ps -o ppid= -p "$pid" | tr -d ' ')
  done
  return 1
}

[ "$(id -u)" = 0 ] || fail "Run this as root (for example: sudo bash server-build.sh)."
# Commands run as the build user need a working directory they can read.
cd /
case "$TARGET_CPU" in
  arm64|arm|x64) ;;
  *) fail "Unknown CPU '$TARGET_CPU' (use arm64, arm or x64)." ;;
esac
[ "$(uname -m)" = x86_64 ] || fail "Chromium can only be built on x86-64 machines."

# Which version to build. The GitHub version is the one of the GitHub releases, unchanged;
# the Google Play version gets the patches of build/cromiko_play_patches_list.txt.
if [ -z "$FLAVOR" ]; then
  if can_ask; then
    cat <<'EOF'

Which version of CromIKO do you want to build?

  1) GitHub version        the Android APK for the GitHub releases, as always
  2) Google Play version   an Android App Bundle (.aab) to upload to the Play
                           Console: no update check (Google Play updates the
                           app) and no background play on YouTube
  3) Windows version       CromIKO for Windows 10 and 11 (64-bit), as a zip
  4) Linux version         CromIKO for Linux (64-bit), as a .tar.xz

EOF
    while [ -z "$FLAVOR" ]; do
      ask "Your choice (1, 2, 3 or 4): " choice
      case "$choice" in
        1|github|GitHub) FLAVOR=github label=GitHub ;;
        2|play|Play) FLAVOR=play label="Google Play" ;;
        3|windows|Windows) FLAVOR=windows label=Windows ;;
        4|linux|Linux) FLAVOR=linux label=Linux ;;
        *) echo "Please type 1 (GitHub), 2 (Google Play), 3 (Windows) or 4 (Linux), then Enter." ;;
      esac
    done
    echo "Building the $label version."
  else
    FLAVOR=github
    echo "Building the GitHub version (set CROMIKO_FLAVOR=play, windows or linux for the others)."
  fi
fi
case "$FLAVOR" in
  github|play|windows|linux) ;;
  *) fail "Unknown CROMIKO_FLAVOR '$FLAVOR' (use github, play, windows or linux)." ;;
esac
if [ "$FLAVOR" = linux ]; then
  TARGET_CPU=x64
fi
if [ "$FLAVOR" = windows ]; then
  TARGET_CPU=x64
  if [ "${CROMIKO_ACCEPT_MSVC_LICENSE:-0}" != 1 ]; then
    can_ask || fail "Set CROMIKO_ACCEPT_MSVC_LICENSE=1 to accept the license terms of Microsoft's build tools."
    cat <<'EOF'

The Windows version is built here, on Linux, with Microsoft's Visual Studio
Build Tools and Windows SDK, which the build downloads from Microsoft. They
come with Microsoft's license terms:
  https://visualstudio.microsoft.com/license-terms/

EOF
    answer=
    while [ -z "$answer" ]; do
      ask "Do you accept them? (y or n): " answer
    done
    case "$answer" in
      y|Y|yes|Yes) CROMIKO_ACCEPT_MSVC_LICENSE=1 ;;
      *) fail "The Windows version can't be built without them." ;;
    esac
  fi
fi
if [ "$FLAVOR" = play ]; then
  if [ -z "$PLAY_RELEASE" ]; then
    if can_ask; then
      cat <<'EOF'

Google Play needs a higher version code for every upload. Which upload is this
for the current Chromium version? 0 for the first one; add 1 for every CromIKO
update that keeps the Chromium version (up to 9).

EOF
      ask "Upload number [0]: " PLAY_RELEASE
    fi
    PLAY_RELEASE=${PLAY_RELEASE:-0}
  fi
  case "$PLAY_RELEASE" in
    [0-9]) ;;
    *) fail "The upload number must be a number from 0 to 9, not '$PLAY_RELEASE'." ;;
  esac
  if [ -z "${CROMIKO_KEYSTORE_PATH:-}" ]; then
    echo
    echo "Note: without CROMIKO_KEYSTORE_PATH, the App Bundle is signed with Chromium's public"
    echo "debug key, and Google Play does not accept it (see docs/BUILD_CROMIKO.md)."
    if can_ask; then
      ask "Build it anyway, for testing only? [y/N]: " answer
      case "${answer:-n}" in
        y|Y|yes|Yes) ;;
        *) fail "Set CROMIKO_KEYSTORE_PATH, CROMIKO_KEYSTORE_ALIAS and CROMIKO_KEYSTORE_PASSWORD, then run this again." ;;
      esac
    fi
  fi
fi
# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}" in
  debian|ubuntu) ;;
  *) fail "This script supports Debian 12 and Ubuntu 22.04/24.04 (found ${PRETTY_NAME:-unknown})." ;;
esac

say "Installing basic tools"
export DEBIAN_FRONTEND=noninteractive
# Keep package installs from stopping at questions, also for the installs
# that Chromium's dependency script runs later.
echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections
if [ -d /etc/needrestart/conf.d ]; then
  echo "\$nrconf{restart} = 'a';" > /etc/needrestart/conf.d/cromiko.conf
fi
apt-get -o DPkg::Lock::Timeout=600 update -q
apt-get -o DPkg::Lock::Timeout=600 install -y -q \
  git curl ca-certificates sudo lsb-release python3 tmux procps

say "Creating the $BUILD_USER user"
if ! id "$BUILD_USER" > /dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$BUILD_USER"
fi
echo "$BUILD_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$BUILD_USER"
chmod 440 "/etc/sudoers.d/$BUILD_USER"

if pgrep -u "$BUILD_USER" -f 'tools/cromiko/build(-android)?\.sh' > /dev/null; then
  fail "A build is already running. Watch it with: sudo -u $BUILD_USER tmux attach -t $SESSION"
fi

mem_gb=$(free -g | awk '/^Mem:/ {print $2}')
if [ "$mem_gb" -lt 32 ] && [ -z "$(swapon --show --noheadings)" ]; then
  say "Adding 16 GB of swap (this machine has ${mem_gb} GB of memory)"
  if fallocate -l 16G /swapfile && chmod 600 /swapfile && mkswap /swapfile > /dev/null \
      && swapon /swapfile; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  else
    rm -f /swapfile
    echo "Could not add swap, continuing without it."
  fi
fi

say "Getting $REPO ($BRANCH)"
if [ -d "$CHECKOUT/.git" ]; then
  as_builder git -C "$CHECKOUT" remote set-url origin "$REPO"
  as_builder git -C "$CHECKOUT" fetch -q --depth 1 origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
  as_builder git -C "$CHECKOUT" checkout -q -B "$BRANCH" "origin/$BRANCH"
else
  as_builder git clone -q --depth 1 -b "$BRANCH" "$REPO" "$CHECKOUT"
fi
# Older branches have tools/cromiko/build-android.sh, and build only the GitHub version
# (or the Google Play one): building another version there would make the GitHub APK of
# that older CromIKO.
BUILD_SCRIPT=tools/cromiko/build.sh
[ -f "$CHECKOUT/$BUILD_SCRIPT" ] || BUILD_SCRIPT=tools/cromiko/build-android.sh
[ -f "$CHECKOUT/$BUILD_SCRIPT" ] \
  || fail "tools/cromiko/build.sh is not on branch $BRANCH of $REPO."
if { [ "$FLAVOR" = play ] && ! grep -q CROMIKO_FLAVOR "$CHECKOUT/$BUILD_SCRIPT"; } \
    || { [ "$FLAVOR" = windows ] && ! grep -q 'windows)' "$CHECKOUT/$BUILD_SCRIPT"; } \
    || { [ "$FLAVOR" = linux ] && ! grep -q 'linux)' "$CHECKOUT/$BUILD_SCRIPT"; }; then
  fail "Branch $BRANCH of $REPO can't build the $FLAVOR version yet. Build the branch with the
newest CromIKO, for example: sudo CROMIKO_BRANCH=<branch> bash server-build.sh"
fi
echo "Building $(as_builder git -C "$CHECKOUT" log -1 --format='%h (%cs) %s')"
echo "with $(grep -c '^CromIKO-.*\.patch$' "$CHECKOUT/build/cromite_patches_list.txt") CromIKO patches"

say "Preparing the build settings"
(umask 077 && : > "$ENV_FILE")
printf 'CROMIKO_FLAVOR=%q\n' "$FLAVOR" >> "$ENV_FILE"
if [ "$FLAVOR" = play ]; then
  printf 'CROMIKO_PLAY_RELEASE=%q\n' "$PLAY_RELEASE" >> "$ENV_FILE"
  echo "Google Play version, upload $PLAY_RELEASE"
elif [ "$FLAVOR" = windows ]; then
  echo 'CROMIKO_ACCEPT_MSVC_LICENSE=1' >> "$ENV_FILE"
  echo "Windows version"
elif [ "$FLAVOR" = linux ]; then
  echo "Linux version"
else
  echo "GitHub version"
fi
if [ -n "${CROMIKO_KEYSTORE_PATH:-}" ]; then
  [ -f "$CROMIKO_KEYSTORE_PATH" ] || fail "Keystore not found: $CROMIKO_KEYSTORE_PATH"
  install -o "$BUILD_USER" -g "$BUILD_USER" -m 600 "$CROMIKO_KEYSTORE_PATH" "$BUILD_HOME/cromiko.keystore"
  {
    printf 'CROMIKO_KEYSTORE_PATH=%q\n' "$BUILD_HOME/cromiko.keystore"
    printf 'CROMIKO_KEYSTORE_ALIAS=%q\n' "${CROMIKO_KEYSTORE_ALIAS:-cromiko}"
    printf 'CROMIKO_KEYSTORE_PASSWORD=%q\n' "${CROMIKO_KEYSTORE_PASSWORD:-}"
  } >> "$ENV_FILE"
  echo "Signing with $CROMIKO_KEYSTORE_PATH"
elif [ "$FLAVOR" != windows ] && [ "$FLAVOR" != linux ]; then
  echo "No CROMIKO_KEYSTORE_PATH: the build is signed with Chromium's public debug key (fine for testing)."
fi
if [ -n "${CROMITE_PREF_HASH_SEED_BIN:-}" ]; then
  printf 'CROMITE_PREF_HASH_SEED_BIN=%q\n' "$CROMITE_PREF_HASH_SEED_BIN" >> "$ENV_FILE"
fi
chown "$BUILD_USER:" "$ENV_FILE"

if [ "$FLAVOR" = play ]; then
  RESULT="App Bundle"
  RESULT_FILES="*-play.aab"
  TEST_FILES="*-play-test.apk"
  NEXT_STEP="The .aab is for the Play Console (your app > Test and release > Create new release);
phones can't install it. To try the Google Play version on your phone first, install the
-play-test.apk: it is the same app in one file."
elif [ "$FLAVOR" = windows ]; then
  RESULT="zip"
  RESULT_FILES="*-win64.zip"
  TEST_FILES=""
  NEXT_STEP="Then unpack it on your Windows PC and start chrome.exe in the CromIKO folder. Windows
may warn about an unknown app the first time: More info > Run anyway."
elif [ "$FLAVOR" = linux ]; then
  RESULT=".tar.xz"
  RESULT_FILES="*-linux64.tar.xz"
  TEST_FILES=""
  NEXT_STEP="Then unpack it on your Linux PC (tar -xJf CromIKO-*-linux64.tar.xz) and start ./cromiko
in the cromiko folder. ./install.sh adds it to the apps of your desktop."
else
  RESULT="APK"
  RESULT_FILES="*-$TARGET_CPU.apk"
  TEST_FILES=""
  NEXT_STEP="Then open it on your phone to install or update CromIKO."
fi

cat > "$RUNNER" <<EOF
#!/bin/bash
# Started by server-build.sh inside the "$SESSION" tmux session.
set -o pipefail
set -a
. "$ENV_FILE"
set +a
export CROMIKO_INSTALL_DEPS=1
cd "$CHECKOUT"
start=\$(date +%s)
if $BUILD_SCRIPT $TARGET_CPU 2>&1 | tee "$BUILD_HOME/cromiko-build.log"; then
  ip=\$(hostname -I | awk '{print \$1}')
  echo
  echo "==== Build finished in \$(( (\$(date +%s) - start) / 60 )) minutes"
  ls -l "$BUILD_HOME/cromiko-build/dist/"
  echo
  echo "Copy the $RESULT to your computer (run this on your computer, not here):"
  echo "  scp 'root@\$ip:$BUILD_HOME/cromiko-build/dist/$RESULT_FILES' ."
  [ -z "$TEST_FILES" ] || echo "  scp 'root@\$ip:$BUILD_HOME/cromiko-build/dist/$TEST_FILES' ."
  echo "$NEXT_STEP"
  echo
  echo "Then delete the server in the Hetzner console: it is billed for as long as it exists."
else
  echo
  echo "==== BUILD FAILED after \$(( (\$(date +%s) - start) / 60 )) minutes"
  echo "The full log is in $BUILD_HOME/cromiko-build.log"
fi
echo
echo "This window stays open. Detach with Ctrl+b, then d."
exec bash
EOF
chown "$BUILD_USER:" "$RUNNER"
chmod 755 "$RUNNER"

say "Starting the build in the background (tmux session \"$SESSION\")"
if as_builder tmux has-session -t "$SESSION" 2> /dev/null; then
  # Keep the windows of earlier builds: this script may be running in one of them.
  as_builder tmux new-window -t "$SESSION:" "bash $RUNNER"
else
  as_builder tmux new-session -d -s "$SESSION" "bash $RUNNER"
fi
cat <<EOF

The build is running and keeps running if you disconnect.
A first build takes several hours.

  Watch it:          sudo -u $BUILD_USER tmux attach -t $SESSION
  Leave it running:  press Ctrl+b, then d
  Log file:          $BUILD_HOME/cromiko-build.log
  $RESULT when done: $BUILD_HOME/cromiko-build/dist/

EOF

if [ -t 0 ] && [ -t 1 ] && ! inside_tmux; then
  exec sudo -u "$BUILD_USER" -H tmux attach -t "$SESSION"
fi
