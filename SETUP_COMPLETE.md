# SFL Browser - New Patch-Based Build System

## Summary

A new, clean patch-based build system has been established for SFL Browser. This system is:
- **Self-contained**: Requires only base Chromium + SFL patches
- **Maintainable**: Each patch is independent and documented
- **Clear**: Exactly what changes are made to Chromium is visible
- **Sustainable**: Easy to update when Chromium updates

## What Changed

### New Files Created

1. **`apply-sfl-patches.sh`** 
   - Applies all SFL patches to Chromium source
   - Handles patch failures gracefully
   - Provides clear progress reporting

2. **`build-sfl-browser.sh`**
   - Main orchestration script
   - Handles: setup → patch → configure → build → collect outputs
   - Supports custom paths and options

3. **`build/sfl_patches_list.txt`**
   - List of patches to apply (in order)
   - Organized by category (branding, privacy, features, build)
   - Only includes necessary patches (not all 300+ Cromite patches)

4. **`PATCH_WORKFLOW.md`**
   - Comprehensive guide to the patch system
   - How to create, update, and debug patches
   - Troubleshooting guide

5. **`BUILD_GUIDE.md`**
   - Quick-start guide for building SFL Browser
   - Common tasks and troubleshooting
   - Directory structure and file purposes

### Patches Copied to `build/patches/`

- `SFL-Branding.patch` - App branding (name, icons, strings)
- `SFL-package-name.patch` - Package renaming to com.sfl.browser

## Current State

### ✅ Ready

The build infrastructure is complete and ready for:
- Applying patches to Chromium
- Building APKs
- Adding new patches
- Updating patches

### ⏳ Next Steps

**Phase 1: Curate SFL Patches** (Create your minimal patch set)

Currently, `build/sfl_patches_list.txt` lists example patches. You need to:

1. **Decide which Cromite features to include**
   - Privacy features (telemetry, tracking disabled)
   - Specific UI features (exit menu, etc.)
   - Performance settings

2. **Review Cromite patches** and decide which ones SFL Browser needs
   - Look at `build/patches/*.patch` (300+ files)
   - Read patch descriptions
   - Determine if each is needed

3. **Update `build/sfl_patches_list.txt`** with your choices
   - Remove patches not needed
   - Add patches you want
   - Organize by category

4. **Test the patch set**
   - Run `apply-sfl-patches.sh` on fresh Chromium
   - Verify all patches apply cleanly
   - Check for conflicts

Example workflow:
```bash
# Clone Chromium
git clone https://chromium.googlesource.com/chromium/src chromium-test
cd chromium-test

# Apply patches
/path/to/SFL-Browser-Chromium/apply-sfl-patches.sh .

# If successful, patches are ready
# If fails, update patches in build/sfl_patches_list.txt
```

**Phase 2: Initial Build Test**

Once patches are finalized:

```bash
./build-sfl-browser.sh
```

This will validate the entire pipeline end-to-end.

**Phase 3: Cleanup** (Remove old scripts)

When confident the new system works:
- Delete: `apply_sfl_branding.sh`, `rebrand_to_sfl.sh`, `rebrand_chromium_complete.sh`
- Delete: `build_apk.sh`, `build_cromite_docker.sh`, `build_sfl_browser_v2.sh`, etc.
- Delete: Old `.gn_args` files no longer used
- Keep: `cromite.gn_args` as reference only
- Keep: `sfl_browser.gn_args` as the active config

## Key Concepts

### Patches are Standalone

Each patch in `build/patches/` can be applied to any compatible Chromium version. They don't depend on Cromite or each other (mostly).

### Patch Lists Control Behavior

`build/sfl_patches_list.txt` determines which patches are applied. You control exactly what features SFL Browser has by editing this file.

### Build Configuration is Separate

`sfl_browser.gn_args` controls:
- Target architecture (arm64)
- Package name (com.sfl.browser)
- Build mode (release/debug)
- Feature flags (GN)

### Single Entry Point

Everything goes through either:
- `build-sfl-browser.sh` - Full build
- `apply-sfl-patches.sh` - Just patch application

## Usage

### Full Build
```bash
./build-sfl-browser.sh
```

### Custom Paths
```bash
./build-sfl-browser.sh \
  --chromium-src ~/chromium/src \
  --output-dir ~/output
```

### Apply Patches Only
```bash
cd ~/my-chromium/src
~/SFL-Browser-Chromium/apply-sfl-patches.sh .
```

## Files to Review

1. **`build/patches/`** - All available patches (300+)
   - Review what Cromite patches do
   - Decide what SFL Browser needs

2. **`build/sfl_patches_list.txt`** - Current patch selection
   - Update based on your decisions

3. **`sfl_browser.gn_args`** - Build configuration
   - Already configured for SFL Browser
   - Customize if needed

4. **`PATCH_WORKFLOW.md`** - Detailed documentation
   - How patch system works
   - How to create patches
   - How to update patches

5. **`BUILD_GUIDE.md`** - Quick reference
   - Common tasks
   - Troubleshooting
   - Directory structure

## What's Different from Before

| Aspect | Before | Now |
|--------|--------|-----|
| **Approach** | Mix Cromite + custom scripts | Pure patches to Chromium |
| **Scripts** | Multiple partial scripts | 2 clean scripts (apply, build) |
| **Patch List** | All 300+ Cromite patches | Only necessary patches |
| **Maintenance** | Hard to track changes | Clear patch history |
| **Updates** | Complex orchestration | Simple patch reapplication |
| **Documentation** | Scattered | Centralized (PATCH_WORKFLOW.md) |

## Next Actions

**Recommended Priority:**

1. ✅ Read `BUILD_GUIDE.md` (5 min)
2. ✅ Review `PATCH_WORKFLOW.md` (15 min)
3. ⏳ Examine `build/patches/` and choose which you need (1-2 hrs)
4. ⏳ Update `build/sfl_patches_list.txt` (30 min)
5. ⏳ Test `apply-sfl-patches.sh` on fresh Chromium (varies)
6. ⏳ Run `build-sfl-browser.sh` for full build (4-8 hrs)
7. ⏳ Cleanup old scripts once confident (15 min)

## Support

- **Build issues**: Check `BUILD_GUIDE.md` troubleshooting
- **Patch questions**: See `PATCH_WORKFLOW.md`
- **Git questions**: Review patch examples in `build/patches/`

---

**Status**: Infrastructure complete and ready for patch curation and testing.

**Next Step**: Start with `BUILD_GUIDE.md` for overview, then `PATCH_WORKFLOW.md` for details.
