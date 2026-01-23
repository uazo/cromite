# SFL Browser - Patch-Based Build System

## Overview

SFL Browser is built by applying a set of patches to the Chromium source code. This approach ensures:
- **Independence**: SFL Browser patches are standalone and can be updated independently
- **Maintainability**: Each patch is documented and can be reviewed individually
- **Clarity**: The exact changes made to Chromium are visible in the patches
- **Future-proofing**: When updating to newer Chromium versions, patches can be re-applied

## Architecture

```
Chromium (base)
    ↓
apply-sfl-patches.sh
    ↓
SFL Browser (complete)
```

### Key Files

| File | Purpose |
|------|---------|
| `apply-sfl-patches.sh` | Main script to apply all SFL patches to Chromium |
| `build-sfl-browser.sh` | Orchestrates entire build process |
| `build/sfl_patches_list.txt` | List of patches to apply (in order) |
| `build/patches/` | Directory containing all SFL patches |
| `sfl_browser.gn_args` | Build configuration for GN build system |

## Workflow

### 1. Understanding the Patches

Patches are stored in `build/patches/` and listed in `build/sfl_patches_list.txt`. Each patch modifies Chromium source code to add SFL Browser functionality:

**Branding patches**: Change app name and package names
- `SFL-Branding.patch` - Display name, icons, UI strings
- `SFL-package-name.patch` - Package naming (com.sfl.browser, etc.)

**Privacy patches**: Disable telemetry and tracking
- `Disable-crash-reporting.patch` - Disable crash reports
- `Disable-various-metrics.patch` - Disable analytics
- etc.

**Feature patches**: Add specific functionality
- `Add-exit-menu-item.patch` - Add exit button to menu
- `Allow-playing-audio-in-background.patch` - Allow background audio
- etc.

### 2. Creating a New Patch

To add a new feature or change:

1. **Make the change** in the Chromium source code
2. **Commit to git** with a clear message:
   ```bash
   cd chromium/src
   git add -A
   git commit -m "Add feature: descriptive name"
   ```
3. **Export the patch**:
   ```bash
   git format-patch HEAD~1 --stdout > ~/path/to/build/patches/Feature-name.patch
   ```
4. **Add to patch list** in `build/sfl_patches_list.txt`:
   ```
   Feature-name.patch
   ```
5. **Test the patch** on a clean Chromium source

### 3. Building SFL Browser

#### Full Build (Recommended)

The `build-sfl-browser.sh` script handles everything:

```bash
./build-sfl-browser.sh
```

This will:
1. Prepare Chromium source (clone/update)
2. Apply all SFL patches
3. Configure build settings
4. Generate build files
5. Build the APK
6. Collect outputs

#### Custom Paths

```bash
./build-sfl-browser.sh \
  --chromium-src ~/my-chromium/src \
  --output-dir ~/my-output
```

#### Manual Steps (For Debugging)

If you need to manually apply patches to an existing Chromium source:

```bash
cd ~/my-chromium/src
~/SFL-Browser-Chromium/apply-sfl-patches.sh .
```

### 4. Patch Application Process

The `apply-sfl-patches.sh` script:

1. **Validates** Chromium source directory
2. **Reads** patch list from `build/sfl_patches_list.txt`
3. **Applies each patch** using `git am`
4. **Reports progress** for each patch
5. **Stops on failure** with recovery instructions

If a patch fails:
```bash
cd chromium/src
git am --abort
# Fix the conflict or update the patch
```

### 5. Build Configuration

Build settings are defined in `sfl_browser.gn_args`:

- **Android-specific settings**: Package name, target CPU, build mode
- **Feature flags**: Disable unnecessary features, enable privacy features
- **Performance settings**: Optimization level, symbol handling
- **Keystore configuration**: Signing settings

To customize the build, edit `sfl_browser.gn_args` and rebuild.

## Patch Categories

### Branding
- Changes app display name to "SFL Browser"
- Updates package names to `com.sfl.browser`
- Replaces icons
- Updates strings and resources

### Privacy/Tracking
- Disables crash reporting and telemetry
- Removes Google telemetry integration
- Disables unwanted APIs (WebRTC IP leaks, intranet detection, etc.)
- Hardens DNS-over-HTTPS

### Features
- Adds UI elements (exit menu, etc.)
- Enables/disables specific browser features
- Adds support for custom settings

### Build Support
- Cromite build utilities
- Build system fixes
- Compilation flags

## Updating Patches

### When Chromium Updates

1. Clone the new Chromium version
2. Apply existing patches:
   ```bash
   ./apply-sfl-patches.sh /path/to/new/chromium/src
   ```
3. If patches fail, update them:
   - Resolve conflicts in the source
   - Commit changes
   - Export updated patch
   - Update `build/patches/` with new patch

### When Features Need to Change

1. Create a new patch OR update an existing one
2. Test on clean Chromium source
3. Update `build/sfl_patches_list.txt` if needed
4. Commit and document the change

## Troubleshooting

### Patch Fails to Apply

**Symptom**: `git am` fails with conflict

**Solution**:
```bash
git am --abort  # Abort current patch
# Fix conflicts manually or update the patch
git am --continue  # If conflicts are resolved
```

### Missing Patch File

**Symptom**: `SKIP: patch_name.patch (file not found)`

**Solution**:
- Verify patch file exists in `build/patches/`
- Check `build/sfl_patches_list.txt` spelling
- Regenerate patch if needed

### Build Fails After Patching

**Symptom**: Build errors after patches applied

**Likely causes**:
- Patch incompatible with Chromium version
- Conflicting patches
- Missing dependencies

**Solution**:
- Check `gn gen` output for configuration errors
- Review patch content for version-specific code
- Update patches for new Chromium version

## Version Information

- **Chromium Base**: Use latest stable version
- **Build System**: GN (Chromium's build system)
- **Target**: Android (arm64)
- **API Level**: 24+

## Next Steps

1. **Review existing patches** in `build/patches/`
2. **Understand patch structure** using `git show` or text editor
3. **Test patch application** on fresh Chromium checkout
4. **Customize patches** for SFL Browser requirements
5. **Build and test** the final APK

## References

- [Chromium Build Documentation](https://chromium.googlesource.com/chromium/src/+/main/docs/README.md)
- [GN Build System](https://gn.googlesource.com/gn/)
- [Git Format-Patch Documentation](https://git-scm.com/docs/git-format-patch)
- [Cromite Project](https://github.com/uazo/cromite)
