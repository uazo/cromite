#!/bin/bash
# SFL Browser - Quick Update Script
# This script checks for new Cromite versions and updates your build

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Checking for latest Cromite version...${NC}"

# Get latest version from GitHub releases
LATEST_VERSION=$(curl -s "https://api.github.com/repos/uazo/cromite/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_VERSION" ]; then
    echo -e "${YELLOW}Could not fetch latest version from GitHub${NC}"
    echo "You can manually specify a version:"
    echo "  ./build-cromite.sh VERSION"
    exit 1
fi

echo -e "${GREEN}Latest Cromite version: ${LATEST_VERSION}${NC}"
echo ""
echo "To build this version, run:"
echo "  ./build-cromite.sh ${LATEST_VERSION}"
echo ""
echo "Or to build current version (141.0.7390.55):"
echo "  ./build-cromite.sh 141.0.7390.55"
