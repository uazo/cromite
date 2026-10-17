#!/bin/bash
# Makes the test media for test.js in site/ (needs ffmpeg).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p site
ffmpeg -hide_banner -loglevel error -f lavfi -i "testsrc=size=640x360:rate=24" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000" -t 90 -c:v libvpx -b:v 160k \
  -deadline realtime -cpu-used 8 -c:a libopus -b:a 32k -y site/clip.webm
ffmpeg -hide_banner -loglevel error -f lavfi -i "testsrc2=size=360x640:rate=24" -t 20 -an \
  -c:v libvpx -b:v 200k -deadline realtime -cpu-used 8 -y site/portrait.webm
ffmpeg -hide_banner -loglevel error -f lavfi -i "sine=frequency=330:sample_rate=44100" -t 60 \
  -c:a libopus -b:a 32k -y site/song.ogg
printf 'WEBVTT\n\n00:00:00.000 --> 00:01:30.000\nHello from CromIKO subtitles\n' > site/subs.vtt
