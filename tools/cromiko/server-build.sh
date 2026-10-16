#!/bin/bash
# One-command CromIKO build on a fresh server (Debian 12, Ubuntu 22.04/24.04).
#
# Log in to the new server as root and run:
#
#   curl -fsSLO https://raw.githubusercontent.com/PupJune2/cromIKO/master/tools/cromiko/server-build.sh
#   bash server-build.sh            # or: bash server-build.sh arm   (arm64, arm, x64)
#
# It installs the basic tools, creates a "builder" user, clones the CromIKO
# repository, and starts tools/cromiko/build-android.sh in a tmux session, so
# the build keeps running if your SSH connection drops. Running it again
# updates the checkout and builds again, reusing the Chromium download.
#
# Environment, all optional:
#   CROMIKO_REPO     repository to build (default: https://github.com/PupJune2/cromIKO)
#   CROMIKO_BRANCH   branch to build (default: master)
#   CROMIKO_KEYSTORE_PATH, CROMIKO_KEYSTORE_ALIAS, CROMIKO_KEYSTORE_PASSWORD
#                    release signing key: path of a keystore file on this
#                    server, its alias and password (see docs/BUILD_CROMIKO.md)
#   CROMITE_PREF_HASH_SEED_BIN
#                    seed for the settings integrity check

set -euo pipefail

TARGET_CPU=${1:-arm64}
REPO=${CROMIKO_REPO:-https://github.com/PupJune2/cromIKO}
BRANCH=${CROMIKO_BRANCH:-master}
BUILD_USER=builder
BUILD_HOME=/home/$BUILD_USER
CHECKOUT=$BUILD_HOME/cromIKO
ENV_FILE=$BUILD_HOME/.cromiko-build.env
RUNNER=$BUILD_HOME/run-cromiko-build.sh
SESSION=cromiko

say() { echo -e "\n==== $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }
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
[ "$(uname -m)" = x86_64 ] || fail "Chromium for Android can only be built on x86-64 machines."
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

if pgrep -u "$BUILD_USER" -f tools/cromiko/build-android.sh > /dev/null; then
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
[ -f "$CHECKOUT/tools/cromiko/build-android.sh" ] \
  || fail "tools/cromiko/build-android.sh is not on branch $BRANCH of $REPO."

say "Preparing the build settings"
(umask 077 && : > "$ENV_FILE")
if [ -n "${CROMIKO_KEYSTORE_PATH:-}" ]; then
  [ -f "$CROMIKO_KEYSTORE_PATH" ] || fail "Keystore not found: $CROMIKO_KEYSTORE_PATH"
  install -o "$BUILD_USER" -g "$BUILD_USER" -m 600 "$CROMIKO_KEYSTORE_PATH" "$BUILD_HOME/cromiko.keystore"
  {
    printf 'CROMIKO_KEYSTORE_PATH=%q\n' "$BUILD_HOME/cromiko.keystore"
    printf 'CROMIKO_KEYSTORE_ALIAS=%q\n' "${CROMIKO_KEYSTORE_ALIAS:-cromiko}"
    printf 'CROMIKO_KEYSTORE_PASSWORD=%q\n' "${CROMIKO_KEYSTORE_PASSWORD:-}"
  } >> "$ENV_FILE"
  echo "Signing with $CROMIKO_KEYSTORE_PATH"
else
  echo "No CROMIKO_KEYSTORE_PATH: the APK is signed with Chromium's public debug key (fine for testing)."
fi
if [ -n "${CROMITE_PREF_HASH_SEED_BIN:-}" ]; then
  printf 'CROMITE_PREF_HASH_SEED_BIN=%q\n' "$CROMITE_PREF_HASH_SEED_BIN" >> "$ENV_FILE"
fi
chown "$BUILD_USER:" "$ENV_FILE"

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
if tools/cromiko/build-android.sh $TARGET_CPU 2>&1 | tee "$BUILD_HOME/cromiko-build.log"; then
  ip=\$(hostname -I | awk '{print \$1}')
  echo
  echo "==== Build finished in \$(( (\$(date +%s) - start) / 60 )) minutes"
  ls -l "$BUILD_HOME/cromiko-build/dist/"
  echo
  echo "Copy the APK to your computer (run this on your computer, not here):"
  echo "  scp 'root@\$ip:$BUILD_HOME/cromiko-build/dist/*.apk' ."
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
  APK when done:     $BUILD_HOME/cromiko-build/dist/

EOF

if [ -t 0 ] && [ -t 1 ] && ! inside_tmux; then
  exec sudo -u "$BUILD_USER" -H tmux attach -t "$SESSION"
fi
