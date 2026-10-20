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
| Custom accent color picker        | medium | done    |
| Pop-up guard with trust score     | large  | done    |
| Pop-up guard settings             | small  | done    |
| One CromIKO settings page         | medium | done    |
| CromIKO for Windows               | large  | started |

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
- Its own animated screen (`CromIKO-DNS-Screen.patch`): an orbit that lights
  up when it is on, a big switch, "Test connection", and the providers as
  cards that tell what they filter, in the accent color.

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

## Custom accent color picker - done

Done in `CromIKO-Accent-Color.patch`, in Settings > Appearance > Accent color.

- 11 colors that go with the charcoal mascot (Periwinkle is the default),
  and Custom: hue and vividness sliders or a hex code.
- Any color other than periwinkle becomes the seed of a Material palette
  for the whole browser, and wins over a theme color picked on the new tab
  page. The CromIKO cards, links and progress bars, the player and manga
  mode follow it; the mascot and the logo keep their periwinkle star.
- Needs Android 12 or newer (on older phones only the player and manga mode
  change). Incognito windows and custom tabs keep their own colors.

## Pop-up guard with trust score - done

Done in `CromIKO-Popup-Guard.patch`.

- Every pop-up is held first, also the ones opened with a tap ("Block all
  pop-ups" is the default of Site settings > Pop-ups and redirects), so
  Adblock Plus no longer has to close them after they opened.
- Redirects of a tab to another site are held too when the user did not ask
  for them: without a tap, started by an ad script, or started by another
  site (an ad frame, the pop-up of the page). Taps on links of the page,
  form posts, reloads and back/forward go through.
- A toast slides up above the toolbar with the address and "Open"; it goes
  away after 8 seconds or with a swipe. "Open" grows a menu out of it: who
  runs the site (a list in the browser, nothing is sent anywhere), the whole
  address, a trust score from 0 to 100 with its reasons, and Open, Block or
  Always allow on the site. Opening something on the Adblock Plus list lets
  its site through Adblock Plus until the browser closes.
- Trust score: known companies start at 95, or 80 when they track their
  visitors (a Google login gets 80); unknown sites at 65, sites on services
  where anyone can make one at 60, ad networks at 15. Being on the Adblock
  Plus list caps it at 25; http, IP addresses, look-alike letters, spam
  domain endings, hidden addresses, short links, app downloads, tracking
  codes, forwarding and opening without a tap lower it; the same site as
  the page raises it.

## Pop-up guard settings - done

Done in `CromIKO-Popup-Guard-Settings.patch`, in Settings > CromIKO >
Pop-up guard and from the weekly shield report.

- How many pop-ups and redirects the guard held this week, and last week.
  A page that tries the same one again counts once; Incognito tabs don't
  count.
- "Hold all pop-ups and redirects": on by default; off leaves only what
  Chromium blocks itself (pop-ups without a tap, its redirect blocking).
- "Always allowed": the sites allowed with "Always allow" in the menu, each
  with a button that removes it again.
- The weekly shield report shows "Pop-ups held this week" with last week's
  number, which opens these settings.

## One CromIKO settings page - done

Done in `CromIKO-Settings.patch`: "CromIKO" at the top of Settings, with
the mascot.

- All CromIKO features in one place, with the icons of the logo (the
  star in the accent color): CromIKO DNS (with its status), pop-up guard,
  ad blocking, weekly shield report (with this week's counts), the
  incognito lock and when it locks, the Fire button, the incognito tab
  tile (a tap adds it to Quick Settings on Android 13 and newer), accent
  color, Edit home screen (opens its dialog), manga mode, the CromIKO
  player and the download manager.
- The settings stay where Chromium has them too (Privacy, Appearance,
  Downloads), so they are found in both places.
- The tops of the CromIKO pages keep their tinted card in the rounded
  style of the settings of Chromium 153.

## CromIKO for Windows

The Windows version is built by `tools/cromiko/build.sh` (option 3 of
`server-build.sh`), cross-compiled on the Linux build server like Cromite's.
Each step below is its own `CromIKO-Windows-*.patch` (or a change of the
build scripts), built and tried before the next one.

The Android features are Android screens (Java), so on Windows each needs a
desktop version: C++ with Chromium's desktop UI (views) for menus, dialogs
and bubbles, and WebUI pages (TypeScript) for the new tab page and settings.
What is already in shared C++ works on Windows as it is: the shield counts,
the secure DNS providers, pop-ups held by default, the download queue code.

### Step 1: CromIKO on Windows - done

`CromIKO-Windows.patch`: the name, the icons (app, incognito, web pages,
PDF, Start menu), the logos, periwinkle as the browser color, its own
profile folder and Windows names so it runs next to Cromite. With the shared
code: secure DNS with Quad9 and the CromIKO providers, every pop-up held
(the icon in the address bar), Cromite's ad blocking.

### Step 2: the CromIKO features that are small on Windows

| # | Feature | On Windows | Effort | Status |
|---|---------|------------|:------:|:------:|
| 2.1 | Fire button | "Burn tabs and data" in the app menu, with the CromIKO fire icon: after a confirmation it closes all tabs and windows, also incognito ones, without keeping them in Recent tabs, deletes history, cookies, site data and cache of all time, and leaves one window with a new tab and "All clean!" (`CromIKO-Windows-Fire-Button.patch`) | small | done, to try |
| 2.2 | CromIKO DNS | The secure DNS setting is named CromIKO DNS, says what each provider filters (ads, family, malware, nothing) in the order of the Android screen, has "Test connection", and "CromIKO DNS" in the app menu opens it (`CromIKO-Windows-DNS.patch`) | small | done, to try |
| 2.3 | Download manager | The CromIKO queue on Windows too: connections per file (faster big files), downloads at the same time, a queue that waits; its settings in Settings > Downloads | small | |
| 2.4 | Accent colors | The CromIKO colors (Periwinkle, Lavender, Mint, ...) first in Customize Chrome | small | |

### Step 3: the CromIKO pages

| # | Feature | On Windows | Effort | Status |
|---|---------|------------|:------:|:------:|
| 3.1 | New tab page | The mascot instead of the Chromium logo, the shield card (ads and trackers blocked this week, opens the report) and the CromIKO shortcuts (bookmarks, downloads, DNS) | medium | |
| 3.2 | Weekly shield report | A CromIKO page (chrome://cromiko/report) with the count of the week, the bars of the days, last week, the sites and trackers blocked the most and the pop-ups held, from the same counts as Android | medium | |
| 3.3 | CromIKO settings | A CromIKO section at the top of Settings with all CromIKO features and their icons, like the Android page: DNS, pop-up guard, ad blocking, report, Fire button, download manager, colors, player, manga mode | medium | |
| 3.4 | Edit the new tab page | The widgets of 3.1 moved, made small or turned off, like Edit home screen on Android | medium | |

### Step 4: the big features

| # | Feature | On Windows | Effort | Status |
|---|---------|------------|:------:|:------:|
| 4.1 | CromIKO player | The same page script (cromiko_video.js) in every frame: the mascot button on videos, the full window player without the site's overlays, "Open in CromIKO player" in the right-click menu and the app menu, and keyboard keys (space, arrows, F, M) | large | |
| 4.2 | Pop-up guard | Redirects to other sites held too (the Android throttle made for all platforms), and instead of Chromium's small bubble a CromIKO bubble with the address, who runs the site and the trust score, Open, Block and Always allow. The trust score and the provider list move to shared C++, so Android and Windows use one copy | large | |
| 4.3 | Manga mode | The reader of cromiko_manga.js: the setup taps, the settings of each site in the profile, the next chapter loaded early, and Continue reading on the new tab page | large | |
| 4.4 | Incognito lock | Incognito windows lock when CromIKO goes to the background and open again with Windows Hello (face, fingerprint or PIN), with the same delay choice as Android | medium | |

### Step 5: a real Windows app

| # | Feature | On Windows | Effort | Status |
|---|---------|------------|:------:|:------:|
| 5.1 | Installer | A setup.exe (Chromium's installer) next to the zip: Start menu and desktop shortcuts, "Make CromIKO your default browser", uninstall in Windows settings, the CromIKO icons for web pages and PDFs | medium | |
| 5.2 | Update check | Like Android's: CromIKO looks at the GitHub releases and shows "Update CromIKO" in the app menu when there is a newer version | small | |
| 5.3 | Welcome | The first start with the mascot, like the Android onboarding: CromIKO DNS, pop-up guard and ad blocking explained, and the default browser question | small | |
| 5.4 | Releases | The Windows zip and setup.exe in the GitHub releases next to the APK | small | |

The order follows what you notice first: step 2 makes the menu and settings
CromIKO, step 3 the pages you see all the time, step 4 brings the big Android
features, step 5 turns the zip into an app that installs and updates like
others. 5.1 can move earlier if the zip is in the way.
