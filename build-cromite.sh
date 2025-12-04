#!/bin/bash
set -e  # Exit on error

# SFL Browser - Cromite Build Script
# This script automates the process of building Cromite with SFL customizations
# Usage: ./build-cromite.sh [VERSION]
# Example: ./build-cromite.sh 141.0.7390.55

# Configuration
CROMITE_VERSION="${1:-141.0.7390.55}"
WORKSPACE_ROOT="${HOME}/cromite-build"
CROMITE_REPO="${WORKSPACE_ROOT}/cromite"
CHROMIUM_SRC="${WORKSPACE_ROOT}/chromium/src"
SFL_PATCHES="${WORKSPACE_ROOT}/sfl-patches"
BUILD_TARGETS="chrome_public_apk"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Setup workspace
setup_workspace() {
    log_info "Setting up workspace at ${WORKSPACE_ROOT}"
    mkdir -p "${WORKSPACE_ROOT}"
    cd "${WORKSPACE_ROOT}"
}

# Step 2: Clone/Update Cromite repository
setup_cromite_repo() {
    log_info "Setting up Cromite repository"
    
    if [ -d "${CROMITE_REPO}" ]; then
        log_info "Updating existing Cromite repository"
        cd "${CROMITE_REPO}"
        git fetch origin
    else
        log_info "Cloning Cromite repository"
        git clone https://github.com/uazo/cromite.git "${CROMITE_REPO}"
        cd "${CROMITE_REPO}"
    fi
    
    # Find the commit hash for this version
    log_info "Looking for Cromite commit for version ${CROMITE_VERSION}"
    
    # Try to find tag or commit matching version
    if git rev-parse "${CROMITE_VERSION}" >/dev/null 2>&1; then
        git checkout "${CROMITE_VERSION}"
    else
        # Try to find in build/RELEASE file
        log_warn "Version tag not found, checking build/RELEASE file"
        git checkout master
        if [ -f "build/RELEASE" ]; then
            RELEASE_VERSION=$(cat build/RELEASE)
            log_info "Latest Cromite release version: ${RELEASE_VERSION}"
        fi
    fi
}

# Step 3: Fetch Chromium source
fetch_chromium() {
    log_info "Fetching Chromium ${CROMITE_VERSION}"
    
    if [ ! -d "${WORKSPACE_ROOT}/chromium" ]; then
        cd "${WORKSPACE_ROOT}"
        fetch --nohooks android
    fi
    
    cd "${CHROMIUM_SRC}"
    
    # Checkout specific version
    log_info "Checking out Chromium ${CROMITE_VERSION}"
    git checkout "${CROMITE_VERSION}"
    
    # Sync dependencies
    log_info "Syncing dependencies (this may take a while...)"
    gclient sync -D --nohooks
}

# Step 4: Remove git submodules (as per Cromite's apply-cromite-patches.sh)
remove_submodules() {
    log_info "Removing git submodules to prepare for patching"
    cd "${CHROMIUM_SRC}"
    
    # Remove v8 submodule
    if [ -d "v8/.git" ]; then
        log_info "Removing v8 submodule"
        rm -rf v8/.git
        cp -r v8 v8bis
        git rm -rf v8 || true
        git submodule deinit -f v8 || true
        mv v8bis v8
        git add -f v8 >/dev/null 2>&1 || true
        git commit -m ":NOEXPORT: v8 repo" >/dev/null 2>&1 || true
    fi
    
    # Remove devtools-frontend submodule
    if [ -d "third_party/devtools-frontend/src/.git" ]; then
        log_info "Removing devtools-frontend submodule"
        rm -rf third_party/devtools-frontend/src/.git
        cp -r third_party/devtools-frontend third_party/devtools-frontend-bis
        git rm -rf third_party/devtools-frontend || true
        git submodule deinit -f third_party/devtools-frontend || true
        rm -rf third_party/devtools-frontend
        mv third_party/devtools-frontend-bis third_party/devtools-frontend
        git add -f third_party/devtools-frontend >/dev/null 2>&1 || true
        git commit -m ":NOEXPORT: third_party/devtools-frontend repo" >/dev/null 2>&1 || true
    fi
    
    # Remove skia submodule
    if [ -d "third_party/skia/.git" ]; then
        log_info "Removing skia submodule"
        rm -rf third_party/skia/.git
        cp -r third_party/skia third_party/skia-bis
        git rm -rf third_party/skia || true
        git submodule deinit -f third_party/skia || true
        rm -rf third_party/skia
        mv third_party/skia-bis third_party/skia
        git add -f third_party/skia >/dev/null 2>&1 || true
        git commit -m ":NOEXPORT: third_party/skia repo" >/dev/null 2>&1 || true
    fi
    
    # Remove perfetto submodule
    if [ -d "third_party/perfetto/.git" ]; then
        log_info "Removing perfetto submodule"
        rm -rf third_party/perfetto/.git
        cp -r third_party/perfetto third_party/perfetto-bis
        git rm -rf third_party/perfetto || true
        git submodule deinit -f third_party/perfetto || true
        rm -rf third_party/perfetto
        mv third_party/perfetto-bis third_party/perfetto
        git add -f third_party/perfetto >/dev/null 2>&1 || true
        git commit -m ":NOEXPORT: third_party/perfetto repo" >/dev/null 2>&1 || true
    fi
    
    git prune >/dev/null 2>&1 || true
}

# Step 5: Apply Cromite patches
apply_cromite_patches() {
    log_info "Applying Cromite patches"
    cd "${CHROMIUM_SRC}"
    
    # Read patch list
    PATCH_LIST="${CROMITE_REPO}/build/cromite_patches_list.txt"
    if [ ! -f "${PATCH_LIST}" ]; then
        log_error "Patch list not found: ${PATCH_LIST}"
        exit 1
    fi
    
    log_info "Found $(grep -c '\.patch$' ${PATCH_LIST}) patches to apply"
    
    # Apply each patch
    while IFS= read -r patch_file; do
        if [[ "$patch_file" == *".patch" ]]; then
            PATCH_PATH="${CROMITE_REPO}/build/patches/${patch_file}"
            
            if [ ! -f "${PATCH_PATH}" ]; then
                log_warn "Patch file not found: ${patch_file}, skipping"
                continue
            fi
            
            log_info "Applying: ${patch_file}"
            
            # Add filename to patch and apply with git am
            REPL="0,/^---/s//FILE:$(basename $patch_file)\n---/"
            cat "${PATCH_PATH}" | sed "${REPL}" | git am
            
            if [ $? -ne 0 ]; then
                log_error "Failed to apply patch: ${patch_file}"
                log_error "You may need to resolve conflicts manually"
                exit 1
            fi
        fi
    done < "${PATCH_LIST}"
    
    log_info "All Cromite patches applied successfully!"
}

# Step 6: Apply SFL customizations
apply_sfl_customizations() {
    log_info "Applying SFL customizations"
    cd "${CHROMIUM_SRC}"
    
    # This will be expanded later to copy SFL Java files
    # For now, just prepare the directory structure
    
    log_info "SFL customizations will be applied here"
    # TODO: Copy SFL Java files, resources, icons, etc.
}

# Step 7: Configure build
configure_build() {
    log_info "Configuring build with Cromite GN args"
    cd "${CHROMIUM_SRC}"
    
    # Copy Cromite's GN args
    CROMITE_GN_ARGS="${CROMITE_REPO}/build/cromite.gn_args"
    
    if [ ! -f "${CROMITE_GN_ARGS}" ]; then
        log_error "Cromite GN args not found: ${CROMITE_GN_ARGS}"
        exit 1
    fi
    
    # Create out directory
    mkdir -p out/Default
    
    # Copy GN args
    cp "${CROMITE_GN_ARGS}" out/Default/args.gn
    
    # Add SFL-specific modifications to args.gn
    cat >> out/Default/args.gn << 'EOF'

# SFL Browser customizations
android_default_version_name = "SFL Browser"
EOF
    
    # Run gn gen
    log_info "Running gn gen"
    gn gen out/Default
}

# Step 8: Build
build_cromite() {
    log_info "Building Cromite (this will take a long time...)"
    cd "${CHROMIUM_SRC}"
    
    # Build using ninja
    autoninja -C out/Default ${BUILD_TARGETS}
    
    if [ $? -eq 0 ]; then
        log_info "Build completed successfully!"
        log_info "APK location: ${CHROMIUM_SRC}/out/Default/apks/"
        ls -lh "${CHROMIUM_SRC}/out/Default/apks/"*.apk 2>/dev/null || true
    else
        log_error "Build failed!"
        exit 1
    fi
}

# Main execution
main() {
    log_info "Starting SFL Browser build process"
    log_info "Cromite version: ${CROMITE_VERSION}"
    
    setup_workspace
    setup_cromite_repo
    fetch_chromium
    remove_submodules
    apply_cromite_patches
    apply_sfl_customizations
    configure_build
    build_cromite
    
    log_info "Build process complete!"
}

# Run main function
main "$@"
