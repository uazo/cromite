# SFL Browser Build System - Quick Start

## What is This?

SFL Browser is built by applying a set of patches to Chromium. This document explains how to build it.

## Quick Start (5 minutes)

### Prerequisites

- **OS**: Linux or macOS (Docker support for Windows)
- **Disk Space**: ~200GB (Chromium build is large)
- **Tools**: `git`, `depot_tools` (from Chromium)

### Building

```bash
# 1. Clone this repository (if not already done)
git clone https://github.com/yourusername/SFL-Browser-Chromium.git
cd SFL-Browser-Chromium

# 2. Run the build script
./build-sfl-browser.sh

# Output APK will be in ~/sfl-output/
```

That's it! The script handles:
- Setting up Chromium source
- Applying all SFL patches
- Configuring build settings
- Building the APK

## What are Patches?

Patches are text files that describe changes to source code. They transform Chromium into SFL Browser by:

1. **Rebranding**: Change app name and icons
2. **Package renaming**: Change package names (com.sfl.browser)
3. **Feature additions**: Add/remove browser features
4. **Privacy hardening**: Disable tracking and telemetry

Example patch structure:
```diff
diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line 1
-old content
+new content
 line 3
```

## How the Build Works

```
1. Fresh Chromium Checkout
           ↓
2. Apply SFL Patches (build/patches/*)
           ↓
3. Configure Build (gn_args)
           ↓
4. Generate Build Files (gn gen)
           ↓
5. Build APK (autoninja)
           ↓
6. SFL Browser APK (ready to install)
```

## Key Files

| File | Purpose |
|------|---------|
| `build-sfl-browser.sh` | Main build script |
| `apply-sfl-patches.sh` | Applies patches to Chromium |
| `build/sfl_patches_list.txt` | List of patches to apply |
| `build/patches/` | All patch files |
| `sfl_browser.gn_args` | Build configuration |
| `PATCH_WORKFLOW.md` | Detailed patch documentation |

## Common Tasks

### Build from Custom Chromium Path

```bash
./build-sfl-browser.sh \
  --chromium-src /path/to/chromium/src \
  --output-dir /path/to/output
```

### Manually Apply Patches to Existing Chromium

```bash
cd /path/to/chromium/src
/path/to/SFL-Browser-Chromium/apply-sfl-patches.sh .
```

### View a Patch

```bash
# See what a patch changes
cat build/patches/SFL-Branding.patch | less

# Or view with git (if patch is applied)
git show <commit>
```

### Create a New Patch

1. Make changes to Chromium source:
   ```bash
   cd chromium/src
   # ... edit files ...
   git add -A
   git commit -m "Add new feature"
   ```

2. Export the patch:
   ```bash
   git format-patch HEAD~1 --stdout > \
     /path/to/build/patches/My-Feature.patch
   ```

3. Add to patch list (`build/sfl_patches_list.txt`):
   ```
   My-Feature.patch
   ```

4. Test on clean Chromium source to verify it works

### Debug a Failed Build

If `apply-sfl-patches.sh` fails:

```bash
cd chromium/src

# See what's wrong
git am --abort

# Fix manually or update the patch
# Then try again
```

If `build-sfl-browser.sh` fails during build:

```bash
cd chromium/src/out/Default

# Check gn configuration
cat args.gn

# Try building manually
autoninja chrome/android:chrome_public_apk_64
```

## Patch Categories

Patches are organized by function:

**Branding & Configuration**
- SFL-Branding.patch - App name, icons, branding
- SFL-package-name.patch - Package naming

**Privacy & Security**
- Disable-crash-reporting.patch
- Disable-various-metrics.patch
- webRTC-do-not-expose-local-IP-addresses.patch
- (see build/sfl_patches_list.txt for full list)

**Features**
- Add-exit-menu-item.patch
- Allow-playing-audio-in-background.patch

**Build Support**
- bromite-build-utils.patch

See `PATCH_WORKFLOW.md` for detailed documentation.

## Troubleshooting

### "Chromium source directory invalid"

```
ERROR: Invalid Chromium source directory
  Expected: .../chrome
```

**Solution**: Point to the actual Chromium source directory:
```bash
ls ~/my-chromium/src/chrome  # Should exist
./build-sfl-browser.sh --chromium-src ~/my-chromium/src
```

### "Patch failed"

```
✗ FAILED: Some-Patch.patch
```

**Causes**:
- Patch incompatible with Chromium version
- Conflicting patches
- Local changes in Chromium source

**Solution**:
```bash
cd chromium/src
git am --abort
# Review the patch and Chromium changes
# Update patch or fix conflicts
```

### Build fails with "gn command not found"

**Solution**: Add depot_tools to PATH:
```bash
export PATH="${PATH}:~/depot_tools"
./build-sfl-browser.sh
```

### Extremely slow build

**Note**: Building Chromium is slow (30 minutes to several hours depending on hardware)

**Optimization**:
- Use faster disk (SSD recommended)
- Increase RAM allocation
- Use `-j` flag in autoninja for parallel builds
- Consider using prebuilt artifacts

## Directory Structure

```
SFL-Browser-Chromium/
├── build/
│   ├── patches/              # All patch files (300+ Cromite + SFL patches)
│   ├── sfl_patches_list.txt  # Which patches to apply (curated subset)
│   └── components/           # Build components
├── build-sfl-browser.sh      # Main build script
├── apply-sfl-patches.sh      # Patch application script
├── sfl_browser.gn_args       # Build configuration
├── PATCH_WORKFLOW.md         # Detailed documentation
└── README.md                 # This file
```

## How to Contribute

1. **Report Issues**: Found a bug? File an issue
2. **Create Patches**: Add features via patches (see "Create a New Patch" above)
3. **Update Patches**: When Chromium updates, help update patches
4. **Test**: Test on various devices/configurations

## Further Reading

- [Chromium Build System](https://chromium.googlesource.com/chromium/src/+/main/docs/)
- [GN Build System](https://gn.googlesource.com/gn/)
- [Git Patches](https://git-scm.com/docs/git-format-patch)
- [PATCH_WORKFLOW.md](PATCH_WORKFLOW.md) - In-depth patch documentation

## Support

- Check [PATCH_WORKFLOW.md](PATCH_WORKFLOW.md) for detailed information
- Review build logs for specific errors
- Search existing issues before creating a new one

---

**Status**: This is a clean, patch-based build system designed for maintainability and clarity.

**Next**: Read [PATCH_WORKFLOW.md](PATCH_WORKFLOW.md) for comprehensive documentation.
