# Building CromIKO

CromIKO is Cromite plus a few extra patches (theme, app icon, app name and
update check, listed at the end of `build/cromite_patches_list.txt`). It is
built the same way as Cromite: download Chromium at the version in
`build/RELEASE`, apply all the patches, compile.

Everything is done by one script, `tools/cromiko/build-android.sh`. The
**Build CromIKO** GitHub Actions workflow
(`.github/workflows/build_cromiko.yaml`) runs that script and gives you the
APK to download.

## What the build machine needs

Chromium is one of the largest open-source projects, so the build needs a
strong machine:

|           | Minimum            | Recommended   |
|-----------|--------------------|---------------|
| System    | Ubuntu 22.04 or 24.04, x86-64 | |
| CPU       | 8 cores            | 16 cores or more |
| Memory    | 16 GB (plus swap)  | 32 to 64 GB   |
| Free disk | 150 GB, SSD        | 250 GB, SSD   |

The first build downloads about 40 GB and then compiles for many hours:
roughly a day on 8 cores, 5 to 8 hours on 16 cores. Later builds reuse the
download and the compiled files, so they are much faster.

GitHub's free runners (4 cores, 16 GB memory, about 14 GB of disk, 6 hours
per job) are far too small for this. You have two options:

1. **A self-hosted runner** (recommended): your own Linux PC or a rented cloud
   server that GitHub sends the job to. This is free on GitHub's side, and
   the machine keeps the Chromium download between builds.
2. **A GitHub "larger runner"**: paid, only for organizations on the GitHub
   Team or Enterprise plan, and still limited to 6 hours per job, so it needs
   32 cores or more.

## 1. Set up a self-hosted runner

1. Prepare an Ubuntu machine that meets the table above. The user that runs
   the runner needs `sudo` without a password, so the workflow can install
   Chromium's build dependencies. (Or install them yourself once and untick
   *Install Chromium build dependencies* when you start the workflow.)
2. On GitHub, open the repository, then **Settings → Actions → Runners → New
   self-hosted runner**, and choose **Linux** and **x64**.
3. Run the commands GitHub shows you on the machine. Keep the default labels;
   the workflow looks for the `self-hosted` label.
4. Install it as a service, so it keeps running after you log out:
   `sudo ./svc.sh install && sudo ./svc.sh start`

The Chromium checkout is kept in `~/cromiko-build` of the runner's user.

## 2. Create a signing key (once)

Android only installs an update if it is signed with the same key as the
installed app. Create your own key and keep a backup of it: if you lose it,
people cannot update to your new releases without uninstalling first.

```sh
keytool -genkeypair -v -keystore cromiko.keystore -alias cromiko \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 cromiko.keystore > cromiko.keystore.b64
```

Use one password for both prompts (store and key); the Chromium build uses a
single password.

Then add these on GitHub under **Settings → Secrets and variables → Actions →
New repository secret**:

| Secret                      | Value |
|-----------------------------|-------|
| `CROMIKO_KEYSTORE_BASE64`   | the contents of `cromiko.keystore.b64` |
| `CROMIKO_KEYSTORE_PASSWORD` | the keystore password |
| `CROMIKO_KEYSTORE_ALIAS`    | `cromiko` (the `-alias` above) |
| `CROMIKO_PREF_HASH_SEED`    | optional: the output of `openssl rand -hex 32`. It protects settings against tampering; once set, keep it the same. |

Without the keystore secrets the build still works, but the APK is signed
with Chromium's public debug key. That is fine for trying it out, not for
releases.

## 3. Run the build

1. Open the **Actions** tab, choose **Build CromIKO**, and click **Run
   workflow**.
2. Pick the CPU: `arm64` is right for almost every phone from the last years.
   Leave the runner as `self-hosted`.
3. Tick **Also publish the APK as a GitHub release** if you want a public
   release. The app's update check (Settings → About CromIKO) looks at the
   latest release of this repository, so publish releases only for builds you
   want people to get.
4. When the run is finished, the APK is under **Artifacts** at the bottom of
   the run page (it downloads as a zip).

The app id is `org.cromiko.cromiko` (set in `build/cromiko.gn_args`), so
CromIKO installs next to Cromite instead of replacing it. Do not change the
id after your first release: Android treats a new id as a different app.

## Building on a rented server with one command

You can also rent a server by the hour (for example a Hetzner Cloud CCX53:
32 cores, 128 GB memory, 600 GB disk) and build there, without GitHub
Actions. Create the server with Debian 12 or Ubuntu 24.04, log in as root and
run:

```sh
curl -fsSLO https://raw.githubusercontent.com/PupJune2/cromIKO/master/tools/cromiko/server-build.sh
bash server-build.sh
```

`tools/cromiko/server-build.sh` installs the basic tools, creates a `builder`
user, clones this repository and starts the build in a tmux session, so it
keeps running if your connection drops. Press Ctrl+b, then d to leave it
running, and `sudo -u builder tmux attach -t cromiko` to look again. When the
build is finished it prints the `scp` command that copies the APK to your
computer. Then delete the server: it is billed for as long as it exists,
even when switched off.

For a signed build, copy your keystore to the server first
(`scp cromiko.keystore root@SERVER-IP:`), then start the build with:

```sh
export CROMIKO_KEYSTORE_PATH=/root/cromiko.keystore
read -rsp "Keystore password: " CROMIKO_KEYSTORE_PASSWORD; export CROMIKO_KEYSTORE_PASSWORD
bash server-build.sh
```

## Building again after changes

A server that has built CromIKO once keeps the Chromium download and the
compiled files. Later builds only apply the patches that changed (and those
after them) and only recompile what they touch, so they are much faster than
the first one.

1. Merge the changes into `master` on GitHub.
2. Log in to the server as root and run the same two commands as above. A
   window left open by the previous build is closed automatically.
3. Copy the new APK to your computer with the `scp` command it prints.

To update the app, open the new APK on the phone and choose **Update**.
Bookmarks, tabs and settings are kept. This works as long as both builds are
signed with the same key: builds without your own keystore all use
Chromium's public debug key, so they update each other. When you switch to
your own keystore, Android refuses the update; uninstall the old CromIKO once
(this deletes its data) and install the new one. Keep using that keystore
from then on.

## Building without GitHub Actions

The build script itself works on any machine from the table above:

```sh
git clone https://github.com/PupJune2/cromIKO
cd cromIKO
CROMIKO_INSTALL_DEPS=1 tools/cromiko/build-android.sh arm64
```

The finished APK is copied to `~/cromiko-build/dist/`. For a signed build,
set `CROMIKO_KEYSTORE_PATH`, `CROMIKO_KEYSTORE_ALIAS` and
`CROMIKO_KEYSTORE_PASSWORD` before running it.

## Cromite's own workflows

The other workflows in `.github/workflows` belong to Cromite and run on
Cromite's build servers. In this repository they fail: **Check git apply**
and **Update patches doc** run on every push and look for the commit in
`uazo/cromite`. Turn them off in the **Actions** tab: select the workflow,
open the **…** menu, and choose **Disable workflow**. Leaving the files
unchanged keeps merging future Cromite updates simple.

## Updating to a new Cromite version

Merge the new Cromite version into this repository. If a CromIKO patch no
longer applies, the build stops at "Applying patches" and names the patch.
The colors, icons and animated drawables can be regenerated with
`tools/cromiko/gen_palette.py`, `tools/cromiko/gen_icons.py` and
`tools/cromiko/gen_drawables.py`; each script explains its usage at the top.
