#!/bin/bash

RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e ${RED} -------- chromium version is: $VERSION ${NC}

echo -e ${RED} -------- cloning depot_tools ${NC}
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git

echo -e ${RED} -------- set envs ${NC}
PATH=/home/lg/working_dir/depot_tools:$PATH
echo $PATH

echo -e ${RED} -------- download chromium repo ${NC}
mkdir ./chromium
cd ./chromium

export DEPOT_TOOLS_UPDATE=0

gclient root

mkdir ./src
cd ./src

CHR_SOURCE=https://chromium.googlesource.com/chromium/src.git
#CHR_SOURCE=https://github.com/chromium/chromium.git

git init
git remote add origin $CHR_SOURCE

git fetch --depth 2 $CHR_SOURCE +refs/tags/$VERSION:chromium_$VERSION
git checkout $VERSION
VERSION_SHA=$( git show-ref -s $VERSION | head -n1 )

echo >../.gclient "solutions = ["
echo >>../.gclient "  { \"name\"        : 'src',"
echo >>../.gclient "    \"url\"         : '$CHR_SOURCE@$VERSION_SHA',"
echo >>../.gclient "    \"deps_file\"   : 'DEPS',"
echo >>../.gclient "    \"managed\"     : False,"

# for windows
# exclude everything but not "microsoft_dxheaders"
echo >>../.gclient "    \"custom_deps\" : {"
echo >>../.gclient "        \"src/third_party/apache-windows-arm64\": None,"
echo >>../.gclient "        \"src/third_party/updater/chrome_win_x86\": None,"
echo >>../.gclient "        \"src/third_party/updater/chrome_win_x86_64\": None,"
echo >>../.gclient "        \"src/third_party/updater/chromium_win_x86\": None,"
echo >>../.gclient "        \"src/third_party/updater/chromium_win_x86_64\": None,"
echo >>../.gclient "        \"src/third_party/gperf\": None,"
echo >>../.gclient "        \"src/third_party/lighttpd\": None,"
echo >>../.gclient "        \"src/third_party/lzma_sdk/bin/host_platform\": None,"
echo >>../.gclient "        \"src/third_party/lzma_sdk/bin/win64\": None,"
echo >>../.gclient "        \"src/third_party/perl\": None,"
echo >>../.gclient "        \"src/tools/skia_goldctl/win\": None,"
echo >>../.gclient "        \"src/third_party/screen-ai/windows_amd64\": None,"
echo >>../.gclient "        \"src/third_party/screen-ai/windows_386\": None,"
echo >>../.gclient "        \"src/third_party/cronet_android_mainline_clang/linux-amd64\": None,"
echo >>../.gclient "        \"src/testing/libfuzzer/fuzzers/wasm_corpus\": None,"
echo >>../.gclient "    },"

echo >>../.gclient "    \"custom_hooks\" : ["
echo >>../.gclient "        { 'name': 'ciopfs_linux', 'pattern': '.', 'action': ['echo', 'ciopfs_linux hook override'] },"
echo >>../.gclient "        { 'name': 'win_toolchain', 'pattern': '.', 'action': ['echo', 'win_toolchain hook override'] },"
echo >>../.gclient "        { 'name': 'rc_win', 'pattern': '.', 'action': ['echo', 'rc_win hook override'] },"
echo >>../.gclient "        { 'name': 'rc_linux', 'pattern': '.', 'action': ['echo', 'rc_linux hook override'] },"
echo >>../.gclient "        { 'name': 'apache_win32', 'pattern': '.', 'action': ['echo', 'apache_win32 hook override'] },"
echo >>../.gclient "    ],"

echo >>../.gclient "    \"custom_vars\": {"
echo >>../.gclient "       \"checkout_android_prebuilts_build_tools\": True,"
echo >>../.gclient "       \"checkout_telemetry_dependencies\": False,"
echo >>../.gclient "       \"codesearch\": 'Debug',"
echo >>../.gclient "    },"
echo >>../.gclient "  },"
echo >>../.gclient "]"
echo >>../.gclient "target_os=['android','win']"

echo -e ${RED} -------- .gclient dump ${NC}
cat ../.gclient

git submodule foreach git config -f ./.git/config submodule.$name.ignore all
git config --add remote.origin.fetch '+refs/tags/*:refs/tags/*'
#git config diff.ignoreSubmodules all

echo -e ${RED} -------- sync third_party repos ${NC}
gclient sync -D --no-history --nohooks

git config user.email "you@example.com"
git config user.name "Your Name"

# remove origin for chromium
# git remote remove origin

echo -e ${RED} -------- running hooks ${NC}
gclient runhooks

echo -e ${RED} -------- download objdump ${NC}
tools/clang/scripts/update.py --package=objdump

echo -e ${RED} -------- remove non-useful big stuffs ${NC}
rm -rf third_party/angle/third_party/VK-GL-CTS/
