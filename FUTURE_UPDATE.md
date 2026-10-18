# CromIKO: future updates

Planned features, sorted by weight (10 = most important). Each one becomes
its own `CromIKO-*.patch`, like the features so far.

| Feature                           | Weight | Effort | Status  |
|-----------------------------------|:------:|:------:|:-------:|
| Video and audio player            | 10     | large  | done    |
| Download manager with threads     | 9      | medium | done    |
| Manga mode: continue reading      | 6      | small  | done    |
| Incognito lock                    | 5      | small  | done    |
| Dark mode per site                | 4      | small  | skipped |
| Built-in DNS                      | 2      | small  | done    |
| Customizable home screen          | 1      | large  | done    |

Second round, picked from the update ideas:

| Feature                           | Effort | Status  |
|-----------------------------------|:------:|:-------:|
| Weekly shield report              | medium | done    |
| Custom accent color picker        | medium | next    |

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

## Download manager with threads (weight 9) - done

Done in `CromIKO-Download-Manager.patch`, in Settings > Downloads >
CromIKO download manager.

- Several connections per file (HTTP range requests): 1 to 8, 4 by
  default.
- Speed and time left in the notification; speed, connections and time
  left in the download list.
- Pause, resume and automatic retry after network loss (Chromium's).
- A queue with a limit on simultaneous downloads (3 by default), and a
  "Wi-Fi only" option. "Start now" runs a waiting download right away.
- Sorting into folders by type (Download/CromIKO/Videos, Music, Pictures,
  Documents, Apps, Archives), off by default.

## Manga mode: continue reading (weight 6) - done

Done in `CromIKO-Manga-Continue-Reading.patch`.

- The last chapter and the place in it are kept for each series (not in
  incognito; the Fire button forgets them).
- A "Continue reading" row on the new tab page, with the series covers and
  progress. A tap goes back to the same place, or to the next chapter once
  one is finished; a long press removes a series.
- The next chapter and its first images load early (a check box in the manga
  mode dialog turns this off).

## Incognito lock (weight 5) - done

Done in `CromIKO-Incognito-Lock.patch`, building on Chromium's incognito
lock.

- Fingerprint, face or PIN to go back to incognito tabs after leaving the
  app: on by default (on devices with a screen lock), with a choice of when
  to lock (right away, or 1, 5 or 15 minutes after leaving).
- "Lock Incognito tabs" in the incognito menu locks them right away.
- The lock screen shows the mascot with a lock.
- Incognito tabs are hidden in the recent apps screen, also when
  screenshots in incognito are allowed.

## Dark mode per site (weight 4) - skipped

Skipped at the user's request.

## Built-in DNS (weight 2) - done

Done in `CromIKO-Secure-DNS.patch` and `CromIKO-DNS-Shortcut.patch`, as
"CromIKO DNS" in Settings > Privacy.

- New providers: AdGuard, dnsforge.de and Mullvad, each with and without
  ad blocking (AdGuard and dnsforge.de also with a family filter). Quad9 is
  listed again; Cloudflare (1.1.1.1) and Google stay.
- Quad9 is CromIKO's default provider; secure DNS is on by default.
- One tap away: a "CromIKO DNS" button next to Bookmarks and Downloads on
  the new tab page, and an item in the app menu.

## Customizable home screen (weight 1) - done

Done in `CromIKO-Home-Screen.patch`.

- "Edit home screen", under the widgets of the new tab page, opens a dialog
  with the mascot: drag the widgets to move them, pick small or large, turn
  them off. The new tab page changes behind the dialog right away.
- Widgets: shortcuts (small: icons only), ads and trackers blocked (small:
  one line), continue reading (small: smaller covers), most visited sites
  (same switch as "Customize Chrome"), and the new recent downloads, with
  the progress and speed of running downloads, then the ones finished this
  week (small: one download).
- The layout is kept with the app's settings (CromIKO on Android has one
  browsing profile), and Reset is one tap.

## Weekly shield report - done

Done in `CromIKO-Shield-Report.patch`. The shield card of the new tab page
opens it ("Weekly report").

- Ads and trackers blocked this week, compared with the same days of last
  week (Monday to yesterday), and last week's total.
- A bar for each day from Monday to Sunday, today in the accent color.
- The 5 sites where CromIKO blocked the most, and the 5 trackers and ad
  servers it blocked the most; early in the week, last week's lists.
- Kept on the device only, never for Incognito tabs. Deleting browsing
  history (also with the Fire button) removes the sites; the counts stay.

## Custom accent color picker - next

- Pick the accent color of CromIKO instead of periwinkle (#5C7CFC), with a
  few colors that go with the charcoal mascot and a custom one.
- The color applies to the whole browser, like the periwinkle theme now.
