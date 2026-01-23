# SFL Browser - System Architecture

## High-Level Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                      SFL Browser Build System                    │
└─────────────────────────────────────────────────────────────────┘

                            Your Goal
                                │
                    ┌───────────▼────────────┐
                    │   SFL Browser APK      │
                    │  (Ready to Install)    │
                    └───────────▲────────────┘
                                │
                     ┌──────────═╩════════────┐
                     │                        │
                ┌────▼──────┐          ┌──────▼────┐
                │   Build   │          │  Package  │
                │  chrome   │          │  APK      │
                │ _public   │          │           │
                │ _apk_64   │          └──────▲────┘
                └────▲──────┘                 │
                     │              ┌─────────┴──────┐
                     │              │                │
              ┌──────▼────────┐    ┌▼──────────┐    │
              │  GN Generate  │    │   Build   │    │
              │  Build Files  │    │  APK File │    │
              └──────▲────────┘    └▼──────────┘    │
                     │              └─────────▲─────┘
                     │                        │
              ┌──────┴──────────────┬─────────┴─────────┐
              │                     │                   │
         ┌────▼──────┐        ┌────▼──────┐    ┌──────▼─────┐
         │ Chromium  │        │  SFL Args  │    │   Build    │
         │ Source    │        │   .gn      │    │ Succeeded  │
         │ (Patched) │        └────▲──────┘    └──────▲─────┘
         └────▲──────┘             │                   │
              │           ┌────────┴───────────┐       │
              │           │                    │       │
         ┌────┴────────────┴─────────┐         │   ┌───┴──────────┐
         │                           │         │   │              │
         │   Apply SFL Patches       │         │   │  No Errors   │
         │  ======================== │         │   │              │
         │  • SFL-Branding.patch     │         │   └──────────────┘
         │  • SFL-package-name.patch │         │
         │  • Disable privacy        │    ┌────▼──────────────┐
         │  • Add features           │    │  gn gen out/...   │
         │  • Build utilities        │    │                   │
         └────▲─────────────────┬────┘    │  Generate Build   │
              │                 │         │  Configuration    │
              │          ┌──────▼──┐      └────▲──────────────┘
              │          │   Pass  │           │
              │          └──────▲──┘           │
              │                 │              │
         ┌────┴─────────────────┴──────────────▼──────────┐
         │                                                │
         │    apply-sfl-patches.sh                        │
         │  ═════════════════════════════                 │
         │  Reads: build/sfl_patches_list.txt             │
         │  Applies patches from: build/patches/          │
         │  Uses: git am                                  │
         │  Output: Patched Chromium source               │
         │                                                │
         └────▲──────────────────────────────┬────────────┘
              │                              │
              │                              │
    ┌─────────┴──────────┐          ┌───────▼──────────┐
    │                    │          │                  │
    │  Fresh Chromium    │          │  patch list      │
    │  Source Clone      │          │  specifies:      │
    │                    │          │  - order         │
    │  git clone         │          │  - which patches │
    │  chromium/src      │          │  - skip list     │
    │                    │          │                  │
    └────┬───────────────┘          └──────▲───────────┘
         │                                  │
         │          ┌───────────────────────┴──┐
         │          │                          │
         │    ┌─────▼──────┐           ┌──────▼────┐
         │    │ build-sfl- │           │  Patches  │
         │    │ browser.sh │           │  on Disk  │
         │    │            │           │           │
         │    │ Orchestrates│           │  300+     │
         │    │ everything │           │  files    │
         │    └────┬───────┘           │  from     │
         │         │                   │  Chromium │
         │         └───────────────────┤  +        │
         │                             │  SFL      │
         │                             │           │
         │                             └──────▲────┘
         │                                    │
         │                                    │
         │                    (You are here)  │
         │                                    │
         └────────────────────────────────────┘

```

## Component Breakdown

### Scripts

```
build-sfl-browser.sh
├─ Validates environment
├─ Prepares Chromium source
│  (clone/update)
├─ apply-sfl-patches.sh
│  ├─ Reads build/sfl_patches_list.txt
│  ├─ Applies each patch from build/patches/
│  └─ Reports progress
├─ Copies sfl_browser.gn_args to out/Default/args.gn
├─ gn gen out/Default
├─ autoninja -C out/Default chrome/android:chrome_public_apk_64
└─ Collects APK to output directory
```

### Patches

```
build/patches/
├─ SFL-Branding.patch
│  └─ Changes: app name, icons, strings
├─ SFL-package-name.patch
│  └─ Changes: package name to com.sfl.browser
├─ Disable-crash-reporting.patch
├─ Disable-various-metrics.patch
├─ Add-exit-menu-item.patch
├─ ... (300+ Cromite patches available)
└─ Plus: Any custom SFL patches

build/sfl_patches_list.txt
├─ Specifies which patches to apply
├─ Order matters
├─ Comments for organization
└─ Makes it easy to enable/disable patches
```

### Configuration

```
sfl_browser.gn_args
├─ android_channel="stable"
├─ chrome_public_manifest_package = "com.sfl.browser"
├─ system_webview_package_name="com.sfl.webview"
├─ target_cpu = "arm64"
├─ is_official_build=true
├─ symbol_level=1
├─ ... (30+ build flags)
└─ Result: APK optimized for SFL Browser
```

## Data Flow

```
User runs: ./build-sfl-browser.sh
                    │
                    ▼
    ┌───────────────────────────────┐
    │ Initialize Chromium Source    │
    │ (clone or prepare existing)   │
    └───────────┬───────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ Read: build/sfl_patches_list  │
    │ (What to apply)               │
    └───────────┬───────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ For each patch:               │
    │ 1. Read from build/patches/   │
    │ 2. Apply with git am          │
    │ 3. Report success/failure     │
    └───────────┬───────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ Copy sfl_browser.gn_args      │
    │ to: out/Default/args.gn       │
    └───────────┬───────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ gn gen out/Default            │
    │ (Generate build config)       │
    └───────────┬───────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ autoninja build               │
    │ (Compile everything)          │
    └───────────┬───────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ Find *.apk files              │
    │ Copy to output directory      │
    └───────────┬───────────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │ APK Ready to Install!         │
    │ Location: ~/sfl-output/       │
    └───────────────────────────────┘
```

## File Organization

```
SFL-Browser-Chromium/
│
├─ apply-sfl-patches.sh        ← Patch applicator script
├─ build-sfl-browser.sh        ← Main build orchestrator
├─ sfl_browser.gn_args         ← Build configuration
│
├─ build/
│  ├─ patches/                 ← All available patches (300+)
│  │  ├─ SFL-Branding.patch
│  │  ├─ SFL-package-name.patch
│  │  ├─ Disable-crash-reporting.patch
│  │  ├─ Add-exit-menu-item.patch
│  │  └─ ... (Cromite patches)
│  │
│  └─ sfl_patches_list.txt     ← Which patches to apply
│
├─ docs/                        ← Documentation
│  ├─ BUILD_GUIDE.md           ← Quick start
│  ├─ PATCH_WORKFLOW.md        ← Detailed patch docs
│  ├─ SETUP_COMPLETE.md        ← Setup summary
│  └─ ARCHITECTURE.md          ← This file
│
└─ README.md                    ← Project overview
```

## Key Design Decisions

### 1. **Single Patch List**
   - `build/sfl_patches_list.txt` is the source of truth
   - Easy to enable/disable features
   - Clear what SFL Browser includes

### 2. **Two Main Scripts**
   - `apply-sfl-patches.sh` - Pure patch application
   - `build-sfl-browser.sh` - Full orchestration
   - Each can be used independently

### 3. **Patches Over Scripts**
   - One patch = one change
   - Easy to review (git diff format)
   - Version control friendly

### 4. **Separate Configuration**
   - `sfl_browser.gn_args` for GN flags
   - `apply-sfl-patches.sh` for source patches
   - Clear separation of concerns

## How to Extend

### Add a New Feature

1. Modify Chromium source
2. `git commit` the changes
3. `git format-patch` to create patch
4. Save to `build/patches/`
5. Add to `build/sfl_patches_list.txt`
6. Test with `apply-sfl-patches.sh`

### Customize Build Flags

Edit `sfl_browser.gn_args`:
```bash
# Enable/disable features
enable_feature_x = true
disable_feature_y = true
```

Then rebuild.

### Update for New Chromium Version

1. Update `build-sfl-browser.sh` to point to new version
2. Try applying patches: `apply-sfl-patches.sh`
3. Fix any conflicts in patches
4. Rebuild and test

## Success Indicators

✅ **System is working when**:
- `apply-sfl-patches.sh` applies all patches without errors
- `build-sfl-browser.sh` completes without failures
- `out/Default/` contains *.apk files
- APK installs and runs on Android device
- App shows "SFL Browser" name and logo

## Next Steps

1. Read `BUILD_GUIDE.md` for overview
2. Review `PATCH_WORKFLOW.md` for details
3. Test `apply-sfl-patches.sh` on fresh Chromium
4. Run `build-sfl-browser.sh` for full build
5. Install and test the APK

---

*This architecture ensures SFL Browser is maintainable, transparent, and easy to update.*
