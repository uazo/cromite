# CromIKO: future updates

Planned features, sorted by weight (10 = most important). Each one becomes
its own `CromIKO-*.patch`, like the features so far.

| Feature                           | Weight | Effort | Status  |
|-----------------------------------|:------:|:------:|:-------:|
| Video and audio player            | 10     | large  | done    |
| Download manager with threads     | 9      | medium |         |
| Manga mode: continue reading      | 6      | small  |         |
| Incognito lock                    | 5      | small  |         |
| Dark mode per site                | 4      | small  |         |
| Built-in DNS                      | 2      | small  |         |
| Customizable home screen          | 1      | large  |         |

## Video and audio player (weight 10) - done

Done in `CromIKO-Video-Player.patch`.

Integrated video assistant (PiP and background playback).

- **Detection:** a page script (like manga mode's) finds `<video>` and
  `<audio>` elements. The browser also notices media requests: MP4, WebM,
  HLS (`.m3u8`) and DASH (`.mpd`).
- **Button:** when media is found, a small mascot play button shows next to
  the video. One tap opens the CromIKO player.
- **Clean player:** plays the stream in a CromIKO page of its own, without
  the site's scripts, so there are no pop-ups, ads or trackers. It keeps the
  site's cookies and referrer, so the stream still loads.
- **Player controls:**
  - Picture-in-picture, and background playback with a media notification.
  - Double-tap to seek; swipe for brightness and volume; speed 0.5x to 3x.
  - Subtitles, an audio-only mode, and resuming where you stopped.
- **Fallbacks:**
  - Streams the page builds with its own code (`blob:` / MSE) can't be
    opened elsewhere. For those, use manga mode's trick: keep the page, hide
    everything around the video, and go fullscreen.
  - Copy-protected (DRM) streams such as Netflix only get the fullscreen
    and picture-in-picture help.

## Download manager with threads (weight 9)

- Chromium already has parallel downloading: several connections per file
  using HTTP range requests (`enable-parallel-downloading`, currently off).
  Turn it on, and let the user choose 1 to 8 connections.
- A downloads page that shows speed, time left and connections for each
  file.
- Pause, resume and automatic retry after network loss.
- A queue with a limit on simultaneous downloads, and a "Wi-Fi only" option.
- Sorting into folders by type (video, music, documents, APKs).

## Manga mode: continue reading (weight 6)

- Remember the last chapter and scroll position for each series.
- A "Continue reading" row on the new tab page, with the series cover.
- Optionally load the next chapter while you read the current one.

## Incognito lock (weight 5)

- Require fingerprint, face or PIN to go back to incognito tabs after
  leaving the app.
- Hide incognito tab content in the recent apps screen.

## Dark mode per site (weight 4)

- Use Chromium's built-in forced dark mode, but switch it on or off per
  site from the menu, remembered for each site.

## Built-in DNS (weight 2)

- Add providers to Chromium's secure DNS (DNS-over-HTTPS) list in
  Settings → Privacy:
  - at least dnsforge.de, Cloudflare (1.1.1.1) and Google (8.8.8.8);
  - also Quad9, Mullvad and AdGuard.
- Make CromIKO's own default choice one of them, instead of the system DNS.

## Customizable home screen (weight 1)

- An edit mode on the new tab page to move, resize and hide widgets.
- Widgets: shield stats, shortcuts, most visited sites, continue reading,
  downloads.
- The layout is saved per profile, and reset is one tap.
