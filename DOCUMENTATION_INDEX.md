# SFL Browser - Complete Documentation Index

## 🚀 Start Here

- **`QUICK_REFERENCE.md`** - One-page cheat sheet (2 min read)
- **`BUILD_GUIDE.md`** - Complete quick-start guide (10 min read)

## 📚 Core Documentation

### Understanding the System
- **`ARCHITECTURE.md`** - Visual system design and data flow
- **`PATCH_WORKFLOW.md`** - Complete guide to patches and patching

### Setup & Status
- **`SETUP_COMPLETE.md`** - What was set up and what to do next

## 🛠️ Building SFL Browser

### Quick Build
```bash
./build-sfl-browser.sh
```
See `BUILD_GUIDE.md` for options and troubleshooting.

### Manual/Advanced
```bash
# 1. Prepare Chromium
cd ~/chromium/src

# 2. Apply patches
~/SFL-Browser-Chromium/apply-sfl-patches.sh .

# 3. Configure build
mkdir -p out/Default
cp ~/SFL-Browser-Chromium/sfl_browser.gn_args out/Default/args.gn

# 4. Generate and build
gn gen out/Default
autoninja -C out/Default chrome/android:chrome_public_apk_64
```

## 📖 Documentation by Purpose

### I Want to...

**Build SFL Browser**
1. Read: `BUILD_GUIDE.md` → Quick Start section
2. Run: `./build-sfl-browser.sh`
3. APK appears in `~/sfl-output/`

**Understand How It Works**
1. Read: `QUICK_REFERENCE.md` (2 min overview)
2. Read: `ARCHITECTURE.md` (visual diagrams)
3. Read: `PATCH_WORKFLOW.md` (detailed info)

**Add a New Feature**
1. Read: `PATCH_WORKFLOW.md` → "Creating a New Patch"
2. Make changes to Chromium source
3. Export as patch file
4. Add to `build/sfl_patches_list.txt`

**Update Patches for New Chromium Version**
1. Read: `PATCH_WORKFLOW.md` → "Updating Patches"
2. Try applying existing patches
3. Fix conflicts if needed
4. Test build

**Debug a Build Failure**
1. Check: `BUILD_GUIDE.md` → Troubleshooting
2. Review build logs
3. Check `PATCH_WORKFLOW.md` for patch-specific issues

**Customize the Build**
1. Edit: `sfl_browser.gn_args` (GN build flags)
2. Or: Edit `build/sfl_patches_list.txt` (which patches apply)
3. Rebuild with `./build-sfl-browser.sh`

## 📂 File Structure

```
Documentation
├─ QUICK_REFERENCE.md        ← 1-page overview (START HERE)
├─ BUILD_GUIDE.md            ← Building and common tasks
├─ ARCHITECTURE.md           ← System design and diagrams
├─ PATCH_WORKFLOW.md         ← Detailed patch documentation
├─ SETUP_COMPLETE.md         ← Setup summary (what changed)
└─ (this file)

Scripts
├─ build-sfl-browser.sh      ← Main build script (use this)
└─ apply-sfl-patches.sh      ← Patch application (advanced)

Configuration
├─ sfl_browser.gn_args       ← Build configuration
└─ build/sfl_patches_list.txt ← Which patches to apply

Patches
└─ build/patches/
   ├─ SFL-Branding.patch
   ├─ SFL-package-name.patch
   └─ (300+ Cromite patches available)
```

## 🎯 Reading Paths

### Path 1: "I Just Want to Build It" (15 min)
1. `QUICK_REFERENCE.md`
2. `BUILD_GUIDE.md` → Quick Start section
3. Run `./build-sfl-browser.sh`

### Path 2: "I Want to Understand Everything" (1 hour)
1. `QUICK_REFERENCE.md` (2 min)
2. `ARCHITECTURE.md` (15 min)
3. `PATCH_WORKFLOW.md` (30 min)
4. `BUILD_GUIDE.md` → Troubleshooting (10 min)

### Path 3: "I Want to Modify It" (2 hours)
1. Complete Path 2 (1 hour)
2. Review `build/patches/*.patch` (30 min)
3. Edit `build/sfl_patches_list.txt` to customize (15 min)
4. Test with `./build-sfl-browser.sh` (ongoing)

### Path 4: "I Want to Add a Feature" (3+ hours)
1. Complete Path 2 (1 hour)
2. Make changes to Chromium source
3. Follow `PATCH_WORKFLOW.md` → "Creating a New Patch"
4. Test `apply-sfl-patches.sh`
5. Test full build with `./build-sfl-browser.sh`

## 📝 Quick Facts

| Aspect | Details |
|--------|---------|
| **Main Script** | `./build-sfl-browser.sh` |
| **Patch List** | `build/sfl_patches_list.txt` |
| **Patches Directory** | `build/patches/` (300+ files) |
| **Build Config** | `sfl_browser.gn_args` |
| **Output** | `~/sfl-output/*.apk` |
| **Build Time** | 30 min - 8 hours (depending on hardware) |
| **Disk Space** | ~200GB for Chromium source |

## 🔄 Workflow Summary

```
1. Clone/prepare Chromium source
2. Apply SFL patches (build/patches/*)
3. Configure build (sfl_browser.gn_args)
4. Generate build files (gn gen)
5. Build APK (autoninja)
6. Output ready at ~/sfl-output/
```

All handled by: `./build-sfl-browser.sh`

Or manually by: `apply-sfl-patches.sh`

## ❓ FAQ

**Q: Where do I start?**
A: Read `QUICK_REFERENCE.md` (2 min) then `BUILD_GUIDE.md` (10 min)

**Q: How do I build?**
A: Run `./build-sfl-browser.sh`

**Q: Can I customize what features are included?**
A: Yes, edit `build/sfl_patches_list.txt` to enable/disable patches

**Q: How do I add a new feature?**
A: See `PATCH_WORKFLOW.md` → "Creating a New Patch"

**Q: What if a patch fails?**
A: See `BUILD_GUIDE.md` → Troubleshooting → "Patch failed"

**Q: Can I use a different Chromium version?**
A: Yes, but patches may need adjustment. See `PATCH_WORKFLOW.md` → "Updating Patches"

**Q: Is this the same as Cromite?**
A: No, SFL Browser uses its own patches for a cleaner, independent build

**Q: What's the difference from before?**
A: See `SETUP_COMPLETE.md` for complete comparison

## 🎓 Learning Resources

### For Understanding Patches
- `PATCH_WORKFLOW.md` - Detailed patch documentation
- `build/patches/*.patch` - Real examples
- [Git Format-Patch Docs](https://git-scm.com/docs/git-format-patch)

### For Understanding Chromium Build
- [Chromium Build Documentation](https://chromium.googlesource.com/chromium/src/+/main/docs/)
- [GN Build System](https://gn.googlesource.com/gn/)
- `sfl_browser.gn_args` - Real build configuration

### For Understanding the System
- `ARCHITECTURE.md` - Visual overview
- `QUICK_REFERENCE.md` - System summary
- Review scripts: `build-sfl-browser.sh`, `apply-sfl-patches.sh`

## ✅ Checklist

- [ ] Read `QUICK_REFERENCE.md`
- [ ] Read `BUILD_GUIDE.md`
- [ ] Run `./build-sfl-browser.sh`
- [ ] Verify APK created in `~/sfl-output/`
- [ ] Test APK on Android device
- [ ] Review `ARCHITECTURE.md` for deeper understanding
- [ ] Read `PATCH_WORKFLOW.md` for patch operations
- [ ] Customize patches if needed

## 🚦 Status

✅ **Build system is complete and ready to use**

Next steps:
1. Start with `QUICK_REFERENCE.md`
2. Follow with `BUILD_GUIDE.md`
3. Run `./build-sfl-browser.sh`

---

**Last Updated**: January 23, 2026

**Version**: 1.0 - Initial patch-based system

**Status**: Production ready
