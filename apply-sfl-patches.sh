#!/bin/bash

# Apply SFL Browser patches to Chromium source
# This script applies all SFL-specific patches that transform Chromium into SFL Browser
#
# Usage:
#   ./apply-sfl-patches.sh [CHROMIUM_SRC_DIR]
#
# Example:
#   ./apply-sfl-patches.sh /home/user/chromium/src
#
# The script will:
#   1. Apply all patches from build/patches/ in order
#   2. Report success/failure for each patch
#   3. Exit on first failure (use git am --abort to recover)

set -e

CHROMIUM_SRC="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PATCH_DIR="$SCRIPT_DIR/build/patches"
PATCH_LIST="$SCRIPT_DIR/build/sfl_patches_list.txt"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Validate inputs
if [ ! -d "$CHROMIUM_SRC/chrome" ]; then
    echo -e "${RED}ERROR: Invalid Chromium source directory${NC}"
    echo "  Expected: $CHROMIUM_SRC/chrome"
    echo ""
    echo "Usage: $0 [CHROMIUM_SRC_DIR]"
    exit 1
fi

if [ ! -f "$PATCH_LIST" ]; then
    echo -e "${RED}ERROR: Patch list not found: $PATCH_LIST${NC}"
    exit 1
fi

cd "$CHROMIUM_SRC"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}=== Applying SFL Browser Patches ===${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Chromium source: $(pwd)"
echo "Patch directory: $PATCH_DIR"
echo ""

# Count total patches
TOTAL_PATCHES=$(grep -c '\.patch$' "$PATCH_LIST" || echo "0")
if [ "$TOTAL_PATCHES" -eq 0 ]; then
    echo -e "${YELLOW}WARNING: No patches found in $PATCH_LIST${NC}"
    exit 0
fi

echo -e "${GREEN}Found $TOTAL_PATCHES patches to apply${NC}"
echo ""

CURRENT=0
FAILED=0
SKIPPED=0

while IFS= read -r patch_file; do
    # Skip empty lines and comments
    if [ -z "$patch_file" ] || [[ "$patch_file" =~ ^# ]]; then
        continue
    fi
    
    # Skip lines that don't end in .patch
    if [[ ! "$patch_file" =~ \.patch$ ]]; then
        continue
    fi
    
    CURRENT=$((CURRENT + 1))
    PATCH_PATH="$PATCH_DIR/$patch_file"
    
    # Check if patch exists
    if [ ! -f "$PATCH_PATH" ]; then
        echo -e "${YELLOW}  [$CURRENT/$TOTAL_PATCHES] SKIP: $patch_file (file not found)${NC}"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi
    
    echo -n -e "${BLUE}  [$CURRENT/$TOTAL_PATCHES] Applying: $patch_file${NC}"
    
    # Try to apply patch with git am
    if git am --3way --keep-cr < "$PATCH_PATH" 2>/dev/null; then
        echo -e "${GREEN} ✓${NC}"
    else
        echo -e "${RED} ✗ FAILED${NC}"
        echo ""
        echo -e "${RED}Patch failed: $patch_file${NC}"
        echo ""
        echo "To recover, run:"
        echo "  cd $CHROMIUM_SRC"
        echo "  git am --abort"
        echo ""
        FAILED=$((FAILED + 1))
        exit 1
    fi
done < "$PATCH_LIST"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Patch application complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Statistics:"
echo "  Applied:  $((CURRENT - SKIPPED))"
echo "  Skipped:  $SKIPPED"
echo "  Failed:   $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All patches applied successfully${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ $FAILED patch(es) failed${NC}"
    exit 1
fi
