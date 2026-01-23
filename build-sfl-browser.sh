#!/bin/bash

# Build SFL Browser from Chromium
#
# This script orchestrates the complete build process:
#   1. Clones/updates Chromium source
#   2. Applies all SFL patches
#   3. Configures build settings
#   4. Builds the APK
#
# Usage:
#   ./build-sfl-browser.sh [OPTIONS]
#
# Options:
#   --chromium-src PATH    Path to Chromium source (default: ~/chromium-src)
#   --output-dir PATH      Output directory for APK (default: ~/sfl-output)
#   --docker               Use Docker for build (default: native)
#   --help                 Show this help message

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHROMIUM_SRC="${CHROMIUM_SRC:-$HOME/chromium-src}"
OUTPUT_DIR="${OUTPUT_DIR:-$HOME/sfl-output}"
USE_DOCKER=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --chromium-src)
            CHROMIUM_SRC="$2"
            shift 2
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --docker)
            USE_DOCKER=true
            shift
            ;;
        --help)
            sed -n '4,19p' "$0"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

log_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}=== $1 ===${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# ==========================================
# STEP 1: Setup
# ==========================================

log_section "SETUP"

log_info "Chromium source: $CHROMIUM_SRC"
log_info "Output directory: $OUTPUT_DIR"
log_info "Build mode: $([ "$USE_DOCKER" = true ] && echo "Docker" || echo "Native")"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"
log_success "Output directory ready"

# ==========================================
# STEP 2: Prepare Chromium Source
# ==========================================

log_section "PREPARE CHROMIUM SOURCE"

if [ -d "$CHROMIUM_SRC/.git" ]; then
    log_info "Chromium source exists, updating..."
    cd "$CHROMIUM_SRC"
    git fetch origin main 2>/dev/null || true
    git reset --hard HEAD 2>/dev/null || true
    log_success "Chromium source updated"
else
    log_info "Cloning Chromium source..."
    mkdir -p "$(dirname "$CHROMIUM_SRC")"
    # Note: Full Chromium clone is large; consider using a shallow clone or existing source
    echo -e "${YELLOW}WARNING: Full Chromium clone is very large (~100GB)${NC}"
    echo "Ensure you have sufficient disk space and network bandwidth"
    exit 1
fi

# ==========================================
# STEP 3: Apply SFL Patches
# ==========================================

log_section "APPLY SFL PATCHES"

cd "$CHROMIUM_SRC"
bash "$SCRIPT_DIR/apply-sfl-patches.sh" "$CHROMIUM_SRC"

log_success "All SFL patches applied"

# ==========================================
# STEP 4: Configure Build
# ==========================================

log_section "CONFIGURE BUILD"

mkdir -p "$CHROMIUM_SRC/out/Default"

# Use the SFL Browser gn_args
if [ -f "$SCRIPT_DIR/sfl_browser.gn_args" ]; then
    cp "$SCRIPT_DIR/sfl_browser.gn_args" "$CHROMIUM_SRC/out/Default/args.gn"
    log_success "Build arguments configured"
else
    log_error "sfl_browser.gn_args not found"
    exit 1
fi

# Show build configuration
echo ""
echo "Build configuration (out/Default/args.gn):"
echo "---"
head -20 "$CHROMIUM_SRC/out/Default/args.gn"
echo "..."
echo "---"
echo ""

# ==========================================
# STEP 5: Generate Build Files
# ==========================================

log_section "GENERATE BUILD FILES"

cd "$CHROMIUM_SRC"

if command -v gn &> /dev/null; then
    gn gen out/Default
    log_success "Build files generated"
else
    log_error "gn command not found"
    echo "Please ensure depot_tools is in your PATH"
    exit 1
fi

# ==========================================
# STEP 6: Build APK
# ==========================================

log_section "BUILD APK"

if command -v autoninja &> /dev/null; then
    cd "$CHROMIUM_SRC"
    
    echo "Building chrome_public_apk_64 (arm64)..."
    autoninja -C out/Default chrome/android:chrome_public_apk_64
    
    log_success "Build completed"
else
    log_error "autoninja command not found"
    exit 1
fi

# ==========================================
# STEP 7: Collect Outputs
# ==========================================

log_section "COLLECT OUTPUTS"

# Find and copy APK
APK_COUNT=$(find "$CHROMIUM_SRC/out/Default" -name "*.apk" -type f | wc -l)

if [ "$APK_COUNT" -gt 0 ]; then
    find "$CHROMIUM_SRC/out/Default" -name "*.apk" -type f -exec cp {} "$OUTPUT_DIR/" \;
    log_success "APK files copied to $OUTPUT_DIR"
    echo ""
    ls -lh "$OUTPUT_DIR"/*.apk
else
    log_error "No APK files found"
    exit 1
fi

# ==========================================
# COMPLETE
# ==========================================

log_section "BUILD COMPLETE"

echo "SFL Browser has been successfully built!"
echo ""
echo "Output location: $OUTPUT_DIR"
echo ""
log_success "Ready to deploy"
