<a href="https://github.com/uazo/cromite/releases/latest">
  <img src="https://img.shields.io/github/v/release/uazo/cromite" alt="current Cromite release" title="current Cromite release" />
</a>
<br>

[![Build Cromite](https://github.com/uazo/cromite/actions/workflows/build_cromite.yaml/badge.svg)](https://github.com/uazo/cromite/actions/workflows/build_cromite.yaml)

# Cromite (a Bromite fork) - Take back your browser

<a href="https://www.cromite.org">
  <img title="Cromite - take back your browser!" src="https://www.cromite.org/app_icon.png" width="96" alt="Bromite" />
</a>
<br>

### **** the documentation is a Work in progress (not the browser :) ****

Cromite is a [Chromium](https://www.chromium.org/Home) fork based on [Bromite](https://github.com/bromite/bromite) with built-in support for ad blocking and an eye for privacy.

Cromite (Major version 120) is available for Android arm64-v8a, arm32-v7a and x86_64, Oreo and above (Minimum v8.0, API level 26) and Windows.

For the Frequently Asked Questions see [F.A.Q.](./FAQ.md).

For documentation see the [wiki](https://github.com/bromite/bromite/wiki).

# Goals

Cromite's goal is to
- limit the features built into the browser that can be used as a platform for tracking users' habits, and, if it is not technically possible, disable them and leave it up to the user to choose whether to re-enable them
- limit the close integration between the browser and its manufacturer
- not let the excellent research work done by csagan5 with Bromite be lost

In addition, Cromite would like to promote greater integration with other non-profit, open source browsers, encouraging closer collaboration with others, and attempt to integrate them directly into Chromium once they have reached an appropriate level of maturity.

# Features

#### Derived from Bromite
* customizable adblock filters via user-provided URL (see https://www.bromite.org/custom-filters) (deprecated, replaced by adblock plus)
* automatically updated adblock filters
* remove click-tracking and AMP from search results
* DNS-over-HTTPS support with any valid IETF DoH endpoint
* always-incognito mode
* disable all field trials permanently
* disable smart search by default, allow web search from incognito mode
* always-visible cookies, javascript and ads site settings from address bar popup
* remove Play integration binary blobs
* ~use [CFI](https://en.wikipedia.org/wiki/Control-flow_integrity) on all architectures except x86 and Windows~ dropped from v117 see https://github.com/uazo/cromite/discussions/292
* enable trivial auto var init
* disable media router and remoting by default
* disable dynamic module loading
* show warnings for TLSv1.0/TLSv1.1 pages
* enable site-per-process isolation for all devices with memory > 1GB
* [proxy configuration page](https://github.com/bromite/bromite/wiki/ProxyConfiguration) with PAC and custom proxy lists support
* settings to disable custom intents and clear session on exit
* flags to toggle anti-fingerprinting mitigations for canvas, audio, client rects, webGL and sensor APIs (see full list below for all the new flags)
* use frozen User-Agent to conceal real model and browser version
* privacy enhancement patches from [Iridium](https://iridiumbrowser.de/), [Inox patchset](https://github.com/gcarq/inox-patchset), [Brave](https://brave.com/) and [ungoogled-chromium](https://github.com/Eloston/ungoogled-chromium) projects
* security enhancement patches from [GrapheneOS](https://github.com/GrapheneOS) project
* reduced referer granularity
* block gateway attacks via websockets (partial fix, see [this upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=590714))
* use 64-bit ABI for webview processes
* make all favicon requests on-demand ([supercookie](https://supercookie.me/) mitigation)
* enable all network isolation features (`PartitionConnectionsByNetworkIsolationKey`, `PartitionHttpServerPropertiesByNetworkIsolationKey`, `SplitHostCacheByNetworkIsolationKey`, `AppendFrameOriginToNetworkIsolationKey`, `SplitCacheByNetworkIsolationKey`, `UseRegistrableDomainInNetworkIsolationKey`, `PartitionSSLSessionsByNetworkIsolationKey`, `PartitionExpectCTStateByNetworkIsolationKey`, `PartitionDomainReliabilityByNetworkIsolationKey`)
* ignore enterprise policies that disallow secure DNS
* ask permission to play protected media
* disable the DIAL repeating discovery
* disable RTCGetCurrentBrowsingContextMedia by default
* disable FLoC and privacy sandbox by default
* disable feeds
* disable reporting of certificate errors
* use pre-defined phone model for client hints and Javascript
* allow forcing external links to open in incognito
* disable AGSA by default
* flag to enable Certificate Transparency
* allow adding search engines from incognito mode
* disable predictors
* disable supervised users
* disable safety check
* disable capability to block `view-source:` URLs
* disable `SegmentationPlatformFeature`, `OptimizationHints`, client hint headers
* disable `AsyncDNS` by default
* customize history expiration threshold
* disable idle detection
* HTTPS-only mode enabled by default
* disable TLS resumption by default
* strict site isolation and strict origin isolation
* partition blobs by top frame URL

#### Cromite-specific features

* Built-in Adblock Plus [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Eyeo-Adblock-Remove-Privacy-Issues.patch) (issue [84](https://github.com/uazo/bromite-buildtools/issues/84))
* policy browser patch for the use of enterprise policy [patch](https://github.com/uazo/bromite/blob/master/build/patches/00add-browser-policy.patch) (issue [191](https://github.com/uazo/bromite-buildtools/issues/191))
  - deactivate safe browsing and extended reporting
  - disabled scroll-to-text-fragment
  - disabled contextual search
  - disabled media router
  - disabled url keyed anonymized data collection
  - disabled translate
  - disabled network prediction
  - disabled sign-in
  - disabled google search side panel
  - disabled automatic https upgrades
* internal firewall to block all unauthorised calls made from the browser [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Internal-firewall.patch) (issue [147](https://github.com/uazo/bromite-buildtools/issues/147))
* show warnings on downloads over HTTP [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Show-warnings-on-downloads-over-HTTP.patch)
* lock profile cookie database [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Lock-Profile-Cookie-Database.patch)
* remove support for device memory and cpu recovery [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Remove-support-for-device-memory-and-cpu-recovery.patch)
* disable speechSynthesis getVoices API [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-speechSynthesis-getVoices-API.patch)
* viewport Protection patch [patch](https://github.com/uazo/bromite/blob/master/build/patches/Viewport-Protection-flag.patch)
* deprecate Data URL in SVGUseElement [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Deprecate-Data-URL-in-SVGUseElement.patch)
* disallow Android App Scheme as referrer [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disallow-Android-App-Scheme-as-referrer.patch)
* disable Compression Dictionary Transport [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-Compression-Dictionary-Transport.patch)
* disable PrivateStateTokens API [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-PrivateStateTokens-API.patch)
* disable GSA by default [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-GSA-by-default.patch)
* disable GetInstalledRelatedApps API [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-GetInstalledRelatedApps-API.patch)
* disable FirstPartySets and StorageAccessAPI [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-FirstPartySets-and-StorageAccessAPI.patch)
* disable WebGPU [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-WebGPU.patch)
* disable GamePad API [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Add-a-flag-to-disable-GamePad-API.patch)
* remove external https connection from chrome://discards [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Remove-https-connection-from-chrome-discards.patch)
* links the use of screen.isExtended to WINDOW_MANAGEMENT permission granted by user [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Multi-Screen-Window-Placement-API-fix.patch)
* clear CORS Preflight Cache on clearing data [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Clear-CORS-Preflight-Cache-on-clearing-data.patch)
* remove auth header upon cross origin redirect [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Remove-auth-header-upon-cross-origin-redirect.patch)
* disable SHA1 Server Signature [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-SHA1-Server-Signature.patch)
* remove detection of captive portals [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Remove-detection-of-captive-portals.patch)
* disable devtools remote and custom protocols [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-devtools-remote-and-custom-protocols.patch)
* enable Document Open Inheritance Removal [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Enable-Document-Open-Inheritance-Removal.patch)
* warning message for unsupported hardware aes [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Warning-message-for-unsupported-hardware-aes.patch)
* partition HSTS cache by NAK [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Partition-HSTS-cache-by-NAK.patch)
* disable password leak detector [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-privacy-issues-in-password-manager.patch)
* keyboard protection flag [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Keyboard-protection-flag.patch)
* disable csp reports [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-csp-reports.patch)
* add setting to clear data on exit [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Add-setting-to-clear-data-on-exit.patch)
* disable visited pseudo class [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-visited-pseudo-class.patch)
* disable BackForwardCache [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-BackForwardCache.patch)
* disable FedCm [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Disable-FedCm.patch)
* partitioning all cookies by top frame domain [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Partitioning-all-cookies-by-top-frame-domain.patch)
* fingerprint mitigation for AudioBuffer and AnalyserNode [patch](https://github.com/uazo/bromite/blob/master/build/patches/AudioBuffer-AnalyserNode-fp-mitigations.patch)

##### from [116.0.5845.111](https://github.com/uazo/cromite/issues/205#issuecomment-1690216310)
* Disable PartnerCustomizations [patch](https://github.com/uazo/cromite/blob/master/build/patches/00Disable-PartnerCustomizations.patch) [#202](https://github.com/uazo/cromite/issues/202)
* Add option to disable snapshots [patch](https://github.com/uazo/cromite/blob/master/build/patches/00Add-option-to-disable-snapshots.patch) [#201](https://github.com/uazo/cromite/issues/201)
* Enable Android Dynamic Performance Framework on renderer [patch](https://github.com/uazo/cromite/blob/master/build/patches/00Enable-Android-Dynamic-Performance-Framework.patch) 

##### from [117.0.5938.63](https://github.com/uazo/cromite/issues/293)
* Added support for blocking in service workers in AdblockPlus #254 [patch](https://github.com/uazo/cromite/blob/master/build/patches/00AdblockPlus-add-blocking-in-service-workers.patch)
* Drop CFI support (see https://github.com/uazo/cromite/discussions/292)
* Enabled Improved Bookmarks UI by default [patch](https://github.com/uazo/cromite/blob/master/build/patches/00Enable-ImprovedBookmarks-by-default.patch)
* Removed Google private API from accounts.google.com [patch](https://github.com/uazo/cromite/blob/master/build/patches/00Remove-GoogleAccountsPrivateApiHost.patch)

##### from [117.0.5938.140](https://github.com/uazo/cromite/issues/349#issuecomment-1740388786)
* Partition MediaDeviceId by default [patch](https://github.com/uazo/cromite/blob/master/build/patches/00Partition-MediaDeviceId-by-default.patch)

##### from [118.0.5993.118](https://github.com/uazo/cromite/issues/458#issuecomment-1780511486)
* Add support for jpeg xl [patch](https://github.com/uazo/cromite/blob/master/build/patches/00Add-support-to-jxl.patch) https://github.com/uazo/cromite/issues/351
* Disable prefers-reduced-transparency media query [patch](https://github.com/uazo/cromite/blob/master/build/patches/00Disable-prefers-reduced-transparency-media-query.patch) https://github.com/uazo/cromite/issues/437
* Show full urls for bookmark [patch](https://github.com/uazo/cromite/blob/master/build/patches/00Show-full-urls-for-bookmark.patch) https://github.com/uazo/cromite/issues/434

##### from [119.0.6045.106](https://github.com/uazo/cromite/issues/484#issuecomment-1788744844)
* Always clear js and wasm code cache at startup
* Block Intents While Locked [patch](https://github.com/uazo/cromite/blob/master/build/patches/00Block-Intents-While-Locked.patch)
* Keep Manta Service Disabled [patch](https://github.com/uazo/cromite/blob/master/build/patches/00Keep-Manta-Service-Disabled.patch)
* (Only windows) Hide the presence of the webcam if the user has not given permission #480

##### from [119.0.6045.124](https://github.com/uazo/cromite/issues/484#issuecomment-17887448441)
* Disable Service and Shared workers on 3P iframe by default [patch](https://github.com/uazo/cromite/commit/8f293b2c9927f1185bbf95e11a280898fe9baa9a)

#### Windows Cromite-specific features

* enable Network Service Sandbox by default
* disable sharing hub
* disable search for image
* simpler logging to file
* disable TabHoverCard images
* enable File System Access blocklist
* enable HighEfficiencyMode by default
* disable annotates on downloads
* enabled pdf plugin by default

## Features not related to privacy

#### Derived da Bromite
* browser automatic updates, enabled by default
* native Android autofill support
* import/export bookmarks
* bookmark all tabs from tabs regroup menu
* allow playing videos in background tabs and disable pause on switching tabs
* all codecs included (proprietary, open H.264 etc.)
* [AV1 codec support](https://github.com/bromite/bromite/wiki/AV1-support)
* [dav1d](https://code.videolan.org/videolan/dav1d) decoder enabled by default
* built with official speed optimizations
* increase number of autocomplete matches from 5 to 10
* allow changing default download storage location
* do not ignore save prompt for users without SD cards
* disable articles and increase number of icons on new tab page
* adding an URL as bookmark will clear its blocked status for the NTP tiles
* history support in incognito mode
* view source of pages
* sticky desktop mode setting
* mobile/desktop user agent customization
* accessibility preference to force tablet UI
* use Alt+D to focus address bar
* allow sharing to Bromite
* UI for crash information collection
* allow OpenSearch search engine detection in incognito
* allow OpenSearch search engine detection with paths
* keyboard dictionary hints in address bar
* always allow `view-source:` URLs
* allow moving navigation bar to bottom
* add option to use home page as NTP

#### Cromite-specific features

* add setting in android to invert tap and long tap [patch](https://github.com/uazo/bromite/blob/master/build/patches/00Add-setting-to-invert-tap-and-long-tap.patch)

(TODO) You can inspect all functionality/privacy changes by reading the [patches](https://github.com/bromite/bromite/tree/master/build/patches) and/or the [CHANGELOG](./CHANGELOG.md).

### Flags

Flags which have been retired from upstream Chromium but are still available in Bromite.

* `#pull-to-refresh`
* `#enable-search-ready-omnibox`
* `#darken-websites-checkbox-in-themes-setting`
* `#simplified-ntp`, enabled by default
* `#enable-text-fragment-anchor`, disabled by default
* `#num-raster-threads`
* `#enable-image-reader`, enabled by default
* `#enable-tab-groups` and `#enable-tab-groups-ui-improvements`
* `#offline-indicator-v2`
* `#enable-jxl`

New flags:

* `#fingerprinting-canvas-image-data-noise`, `#fingerprinting-client-rects-noise` and `#fingerprinting-canvas-measuretext-noise`, enabled by default
* `#incognito-screenshot`, disabled by default
* `#max-connections-per-host`
* `#resume-background-video`
* `#ipv6-probing`
* `#enable-device-motion` and `#enable-device-orientation`
* `#show-legacy-tls-warnings`
* `#save-data-header`, disabled by default
* `#export-bookmarks-use-saf`, disabled by default
* `#allow-user-certificates`, disabled by default
* `#cleartext-permitted`, enabled by default, can be used to disable all cleartext-HTTP traffic
* `#omnibox-autocomplete-filtering`, can be used to restrict omnibox autocomplete results
* `#disable-external-intent-requests`, can be used to disable opening any external app for any URL
* `#enable-userscripts-log`, see https://github.com/bromite/bromite/wiki/UserScripts#flags
* `#certificate-transparency-enabled`, enabled by default; see https://chromium.googlesource.com/chromium/src/+/master/net/docs/certificate-transparency.md
* `#move-top-toolbar-to-bottom`, disabled by default
* `#site-engagement`, enabled by default, can be used to disable the automatically-generated icons for most visited sites on the NTP

### Site settings

* webGL, disabled by default
* images, enabled by default
* Javascript JIT, disabled by default
* timezone customization override
* autoplay, disabled by default
* webRTC, disabled by default
* viewport protection, enabled by default

# Privacy limitations

Cromite's privacy features, including anti-fingerprinting mitigations (which are not comprehensive), **are not to be considered useful for journalists and people living in countries with freedom limitations**, please look at [Tor Browser](https://www.torproject.org/download/) in such cases.
Please note that this project is not free of bugs and that changing the behaviour of a browser can be risky and not without problems.

# Releases

All built versions are available as [releases](https://github.com/uazo/cromite/releases).

Cromite is currently built for ARM64, x86 (Android SDK version 23+) and Windows x64.

You will automatically receive notifications about new updates (and be able to install them) via the auto updater functionality (enabled by default), see [related wiki page](https://github.com/bromite/bromite/wiki/AutomaticUpdates).

### F-droid

Official F-droid repo url:
https://www.cromite.org/fdroid/repo/?fingerprint=49F37E74DEE483DCA2B991334FB5A0200787430D0B5F9A783DD5F13695E9517B

### Auto-update setup for windows

1. Download https://github.com/henrypp/chrlauncher/releases
2. Create a `chrlauncher.ini`

```
[chrlauncher]

# Custom Chromium update URL (string):
ChromiumUpdateUrl=https://github.com/uazo/cromite/releases/latest/download/updateurl.txt

# Command line for Chromium (string):
# note --user-data-dir= works better if path is absolute
# See here: http://peter.sh/experiments/chromium-command-line-switches/
ChromiumCommandLine=--user-data-dir=".\User Data" --no-default-browser-check

# to enable full logging in c:\temp\log.txt (daily rotate, no automatic deletion)
# ChromiumCommandLine=--enable-logging --v=0 --log-file=C:\temp\log.txt --user-data-dir=".\User Data" --no-default-browser-check

# Chromium executable file name (string):
ChromiumBinary=chrome.exe

# Chromium binaries directory (string):
# Relative (to chrlauncher directory) or full path (env. variables supported).
ChromiumDirectory=.\bin
```

### Enable network process sandbox in windows
I don't include any setups because I don't like the experience of not knowing what they do, so you must manually run this command on first installation:
```
cd <where_is_the_exe>
icacls . /grant "*S-1-15-2-2:(OI)(CI)(RX)"
```
see https://github.com/uazo/bromite-buildtools/issues/51

## (TODO) Integrity and authenticity

You can verify the integrity of a downloaded APK file from this project with any `sha256sum`-compatible tool by downloading the corresponding `brm_X.Y.Z.sha256.txt` or `chr_X.Y.Z.sha256.txt` file, where X.Y.Z is the release version number. Example:
```
$ sha256sum --check brm_68.0.3440.54.sha256.txt
arm64_SystemWebView.apk: OK
arm64_ChromePublic.apk: OK
arm64_ChromeModernPublic.apk: OK
```

You can verify authenticity, e.g. that the author ([csagan5](https://github.com/csagan5)) released the file, by using gpg2:
```
$ gpg2 --quiet --verify brm_68.0.3440.54.sha256.txt.asc
gpg: assuming signed data in 'brm_68.0.3440.54.sha256.txt'
gpg: Signature made Sun 08 Jul 2018 04:22:52 PM CEST using RSA key ID D85DC0C5
gpg: Good signature from "csagan5 <32685696+csagan5@users.noreply.github.com>"
```

You can download csagan5's public GnuPG key from here: [csagan5.asc](./csagan5.asc).

# (TODO) How to build

The [Bromite main repository](https://github.com/bromite/bromite) contains tags for each corresponding Chromium release (see https://chromium.googlesource.com/chromium/src.git).

Please refer to [official Chromium build documentation](https://www.chromium.org/developers/how-tos/get-the-code) to get started on how to build Chromium; if you can build Chromium for Android, you can build Bromite.

The Chromium version tag used as base for the patches is available here: [RELEASE](./build/RELEASE); this is always corresponding to the git tag for every release.
The GN args used to build Bromite are available here: [bromite.gn_args](./build/bromite.gn_args).
The patches are to be applied second the order specified in the `bromite_patches_list.txt` file (you can use `git am`).

# (TODO) Contributing

Please submit issues following the issue template; beware that GitHub does not display the templates from mobile.

Patches are welcome and accepted if they match the project goals.

For any usage or development discussion please use GitHub Discussions: https://github.com/uazo/cromite/discussions

# Credits

* [Chromium project](https://www.chromium.org/Home) and developers
* [Bromite](https://github.com/bromite/bromite)
  * [Iridium project](https://github.com/iridium-browser) for some patches
  * [ungoogled-chromium](https://github.com/Eloston/ungoogled-chromium) for some patches
  * [ungoogled-chromium-android](https://github.com/ungoogled-software/ungoogled-chromium-android) for some patches
  * [GrapheneOS](https://github.com/GrapheneOS) for some security patches
  * [Inox patchset](https://github.com/gcarq/inox-patchset) for some patches (via ungoogled-chromium)
  * [Brave Browser](https://github.com/brave/brave-core) for some patches

# (TODO) License

The patches published as part of the Bromite project are released under [GNU GPL v3](./LICENSE).

[version-image]: https://img.shields.io/github/release/bromite/bromite.svg?style=flat-square
[version-url]: https://github.com/bromite/bromite/releases/latest
[license-image]: https://img.shields.io/github/license/bromite/bromite.svg
[license-url]: https://github.com/bromite/bromite/blob/master/LICENSE
