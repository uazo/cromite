#!/bin/bash
# Tests the queue of the CromIKO download manager (cromiko_download_queue.cc of
# build/patches/CromIKO-Download-Manager.patch) with fake downloads. stubs/ has
# small stand-ins for the Chromium headers that the queue uses.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out/chrome/browser/download
for file in cromiko_download_queue.h cromiko_download_queue.cc; do
  # The patch adds the file: its lines are the "+" lines after its header.
  awk -v path="b/chrome/browser/download/$file" '
    /^\+\+\+ / { copy = ($2 == path); next }
    /^diff --git / { copy = 0 }
    copy && /^@@/ { next }
    copy { print substr($0, 2) }
  ' ../../../build/patches/CromIKO-Download-Manager.patch > "out/chrome/browser/download/$file"
done
g++ -std=c++20 -g -fsanitize=address,undefined -Wall -Wno-unused-parameter \
  -Iout -Istubs out/chrome/browser/download/cromiko_download_queue.cc \
  queue_test.cc -o out/queue_test
out/queue_test
