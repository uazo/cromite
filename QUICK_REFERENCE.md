# Quick Reference - SFL Browser Build System

## One-Line Build
```bash
./build-sfl-browser.sh
```

## Essential Files

| File | Purpose | When to Use |
|------|---------|------------|
| `apply-sfl-patches.sh` | Apply patches to Chromium | Testing/debugging |
| `build-sfl-browser.sh` | Full build orchestrator | Normal builds |
| `build/sfl_patches_list.txt` | List of patches to apply | Enable/disable features |
| `sfl_browser.gn_args` | Build configuration | Customize build settings |

## Read These (In Order)

1. **`BUILD_GUIDE.md`** (5 min) - Start here for overview
2. **`ARCHITECTURE.md`** (10 min) - Visual system overview
3. **`PATCH_WORKFLOW.md`** (20 min) - Complete reference
4. **`SETUP_COMPLETE.md`** (5 min) - Summary of changes

## Common Tasks

### Build SFL Browser
```bash
./build-sfl-browser.sh
```
Outputs APK to `~/sfl-output/`

### Build with Custom Paths
```bash
./build-sfl-browser.sh \
  --chromium-src ~/my-chromium/src \
  --output-dir ~/my-output
```

### Test Patches on Fresh Chromium
```bash
cd ~/fresh-chromium/src
~/SFL-Browser-Chromium/apply-sfl-patches.sh .
```

### Add a New Feature
1. Edit Chromium source
2. `git add -A && git commit -m "My change"`
3. `git format-patch HEAD~1 --stdout > build/patches/My-Feature.patch`
4. Add to `build/sfl_patches_list.txt`
5. Test: `apply-sfl-patches.sh`

### View What a Patch Does
```bash
cat build/patches/SFL-Branding.patch | less
```

### Update a Patch
1. Resolve conflict in source
2. `git add -A && git commit -m "Fixed"`
3. `git format-patch HEAD~1 --stdout > build/patches/Name.patch`
4. Test on fresh Chromium

## If Something Fails

### Patch Failed
```bash
cd chromium/src
git am --abort  # Abort current patch
# Then investigate why it failed
```

### Build Failed
```bash
cd chromium/src/out/Default
cat args.gn  # Check configuration
# Or review build log for specific errors
```

### Wrong Patches Being Applied
Edit `build/sfl_patches_list.txt` to enable/disable patches

## Key Concepts

- **Patches**: Text files (`.patch`) that modify Chromium
- **Patch List**: `build/sfl_patches_list.txt` controls which patches apply
- **GN Args**: `sfl_browser.gn_args` configures the build
- **Scripts**: 2 main scripts (apply patches, orchestrate build)

## Directory Structure

```
SFL-Browser-Chromium/
├─ apply-sfl-patches.sh      ← Apply patches
├─ build-sfl-browser.sh      ← Full build
├─ sfl_browser.gn_args       ← Build config
├─ build/patches/            ← All patch files (300+)
├─ build/sfl_patches_list.txt ← Which to apply
└─ docs/
   ├─ BUILD_GUIDE.md         ← START HERE
   ├─ ARCHITECTURE.md        ← Visual overview
   ├─ PATCH_WORKFLOW.md      ← Complete reference
   └─ SETUP_COMPLETE.md      ← What changed
```

## System Overview

```
Fresh Chromium
    ↓ apply-sfl-patches.sh
Patched Chromium
    ↓ gn gen + autoninja
SFL Browser APK ✓
```

## What's Inside SFL Browser

- ✅ Chrome branding changed to "SFL Browser"
- ✅ Package name: com.sfl.browser
- ✅ Custom icons
- ✅ Privacy features (telemetry disabled)
- ✅ Selected Cromite features
- ✅ Custom build configuration

## Next Steps

1. Read `BUILD_GUIDE.md` for overview
2. Review what patches you need
3. Run: `./build-sfl-browser.sh`
4. Test the APK on an Android device

## Support

- **Overview**: `BUILD_GUIDE.md`
- **Details**: `PATCH_WORKFLOW.md`
- **Architecture**: `ARCHITECTURE.md`
- **What Changed**: `SETUP_COMPLETE.md`

---

**Status**: Ready to build. Follow BUILD_GUIDE.md next.
