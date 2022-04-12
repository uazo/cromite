# Bromite - Take back your browser
<a href="https://github.com/bromite/bromite/releases/latest">
  <img src="https://www.bromite.org/release.svg" alt="current Bromite release" title="current Bromite release" /> </a>
<a href="https://github.com/bromite/bromite/blob/master/LICENSE">
  <img src="https://www.bromite.org/license.svg" alt="GNU GPL v3" title="GNU VPL v3" />
</a> <br>
<a href="https://www.bromite.org">
  <img title="Bromite - take back your browser!" src="https://www.bromite.org/android-icon-192x192.png" width="96" alt="Bromite" />
</a>

Bromite is a [Chromium](https://www.chromium.org/Home) fork with support for ad blocking and enhanced privacy.

Bromite is only available for Android Marshmallow (v6.0, API level 23) and above.

<img src="https://fdroid.bromite.org/fdroid/bromite_bromite_gh_downloads.svg" alt="Downloads on Github" title="Downloads on Github" />

For the Frequently Asked Questions see [F.A.Q.](./FAQ.md).

For documentation see the [wiki](https://github.com/bromite/bromite/wiki).

# Goals

Bromite aims at providing a no-clutter browsing experience without privacy-invasive features and with the addition of a fast ad-blocking engine.
Minimal UI changes are applied to help curbing the idea of "browser as an advertisement platform".

# Donate

Please donate to support development of Bromite and the costs for the build system.

[&rarr; Support development with a donation](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=JP3XTQPVRNET2): [![paypal](https://www.bromite.org/assets/img/btn_donate_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=JP3XTQPVRNET2)

<a href="bitcoin:bc1qlx7h0lj9z88g2xfeuwsrtfs77sxuhrxf2t28sw">BTC donations address</a>: `bc1qlx7h0lj9z88g2xfeuwsrtfs77sxuhrxf2t28sw`

ETH donations address: `0x5d392F8FBf3465afe05B1Adc575e248D33B891F6`

# Features

* customizable adblock filters via user-provided URL (see https://www.bromite.org/custom-filters)
* automatically updated adblock filters
* remove click-tracking and AMP from search results
* DNS-over-HTTPS support with any valid IETF DoH endpoint
* always-incognito mode
* disable all field trials permanently
* disable smart search by default, allow web search from incognito mode
* always-visible cookies, javascript and ads site settings
* remove Play integration binary blobs
* use [CFI](https://en.wikipedia.org/wiki/Control-flow_integrity) on all architectures except x86
* enable trivial auto var init
* disable media router and remoting by default
* disable dynamic module loading
* show warnings for TLSv1.0/TLSv1.1 pages
* enable site-per-process isolation for all devices with memory > 1GB
* completely remove safe browsing and other privacy-unfriendly features
* [proxy configuration page](https://github.com/bromite/bromite/wiki/ProxyConfiguration) with PAC and custom proxy lists support
* settings to disable custom intents and clear session on exit
* flags to toggle anti-fingerprinting mitigations for canvas, audio, client rects, webGL and sensor APIs (see full list below for all the new flags)
* use frozen User-Agent to conceal real model and browser version
* privacy enhancement patches from [Iridium](https://iridiumbrowser.de/), [Inox patchset](https://github.com/gcarq/inox-patchset), [Brave](https://brave.com/) and [ungoogled-chromium](https://github.com/Eloston/ungoogled-chromium) projects
* security enhancement patches from [GrapheneOS](https://github.com/GrapheneOS) project
* disable scroll-to-text-fragment
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
* site settings to disable images
* allow forcing external links to open in incognito
* disable AGSA by default
* allow disabling JIT (per-site, disabled by default)
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

## Features not related to privacy
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
* timezone customization
* sticky desktop mode setting
* disable video autoplay by default, reintroduce site settings
* mobile/desktop user agent customization
* accessibility preference to force tablet UI
* use Alt+D to focus address bar
* allow sharing to Bromite
* UI for crash information collection
* allow OpenSearch search engine detection in incognito
* allow OpenSearch search engine detection with paths
* keyboard dictionary hints in address bar
* always allow `view-source:` URLs

You can inspect all functionality/privacy changes by reading the [patches](https://github.com/bromite/bromite/tree/master/build/patches) and/or the [CHANGELOG](./CHANGELOG.md).

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

New flags:

* `#fingerprinting-canvas-image-data-noise`, `#fingerprinting-client-rects-noise` and `#fingerprinting-canvas-measuretext-noise`, enabled by default
* `#enable-incognito-snapshots-in-android-recents`, disabled by default
* `#max-connections-per-host`
* `#resume-background-video`
* `#ipv6-probing`
* `#disable-webgl`
* `#enable-device-motion` and `#enable-device-orientation`
* `#show-legacy-tls-warnings`
* `#save-data-header`, disabled by default
* `#export-bookmarks-use-saf`, disabled by default
* `#allow-user-certificates`, disabled by default
* `#cleartext-permitted`, enabled by default, can be used to disable all cleartext-HTTP traffic
* `#omnibox-autocomplete-filtering`, can be used to restrict omnibox autocomplete results
* `#disable-external-intent-requests`
* `#enable-userscripts-log`, see https://github.com/bromite/bromite/wiki/UserScripts#flags
* `#certificate-transparency-enabled`, enabled by default; see https://chromium.googlesource.com/chromium/src/+/master/net/docs/certificate-transparency.md

# Privacy limitations

Bromite's privacy features, including anti-fingerprinting mitigations (which are not comprehensive), **are not to be considered useful for journalists and people living in countries with freedom limitations**, please look at [Tor Browser](https://www.torproject.org/download/) in such cases.

# Releases

All built versions are available as [releases](https://github.com/bromite/bromite/releases); the [official website](https://www.bromite.org/) points to those releases and - when browsing via Android - it will automatically highlight the one apt for your device (or none otherwise).

Each tag corresponds to a Chromium Stable release tag.

Bromite is currently built for ARM, ARM64 and x86 and for the Android SDK version 23+; [Bromite SystemWebView](https://www.bromite.org/system_web_view) is provided as well (SDK23+).
For every Bromite build you can always find a matching [vanilla Chromium](https://www.bromite.org/chromium) build which is used for example to verify which issues are specific to Bromite or not.

You will automatically receive notifications about new updates (and be able to install them) via the auto updater functionality (enabled by default), see [related wiki page](https://github.com/bromite/bromite/wiki/AutomaticUpdates).

All official releases are also available through the [official third-party F-Droid repository](https://www.bromite.org/fdroid).

## Integrity and authenticity

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

# How to build

The [Bromite main repository](https://github.com/bromite/bromite) contains tags for each corresponding Chromium release (see https://chromium.googlesource.com/chromium/src.git).

Please refer to [official Chromium build documentation](https://www.chromium.org/developers/how-tos/get-the-code) to get started on how to build Chromium; if you can build Chromium for Android, you can build Bromite.

The Chromium version tag used as base for the patches is available here: [RELEASE](./build/RELEASE); this is always corresponding to the git tag for every release.
The GN args used to build Bromite are available here: [bromite.gn_args](./build/bromite.gn_args).
The patches are to be applied second the order specified in the `bromite_patches_list.txt` file (you can use `git am`).

## How to build the filters

See upstream documentation: https://github.com/chromium/chromium/blob/master/components/subresource_filter/FILTER_LIST_GENERATION.md

Bromite uses an unindexed filter file, which is periodically published at https://github.com/bromite/filters

# Contributing

Please submit issues following the issue template; beware that GitHub does not display the templates from mobile.

Patches are welcome and accepted if they match the project goals.

For any usage or development discussion please use GitHub Discussions: https://github.com/bromite/bromite/discussions

# Credits

* [Chromium project](https://www.chromium.org/Home) and developers
* [Iridium project](https://github.com/iridium-browser) for some patches
* [ungoogled-chromium](https://github.com/Eloston/ungoogled-chromium) for some patches
* [ungoogled-chromium-android](https://github.com/ungoogled-software/ungoogled-chromium-android) for some patches
* [GrapheneOS](https://github.com/GrapheneOS) for some security patches
* [Inox patchset](https://github.com/gcarq/inox-patchset) for some patches (via ungoogled-chromium)
* [Brave Browser](https://github.com/brave/brave-core) for some patches
* [Vadim Pleshkov](http://vadimpleshkov.me/) for Bromite's logo

# Filters credits
* [EasyList](https://easylist.to/#easylist)
* [EasyPrivacy](https://easylist.to/#easyprivacy)
* [uBlock Origin](https://github.com/uBlockOrigin)
* [Peter Lowe's Ad and tracking server list](https://pgl.yoyo.org/adservers/)

The URLs of the lists used are available at: https://github.com/bromite/filters/blob/master/lists.txt

# License

The patches published as part of the Bromite project are released under [GNU GPL v3](./LICENSE).

[version-image]: https://img.shields.io/github/release/bromite/bromite.svg?style=flat-square
[version-url]: https://github.com/bromite/bromite/releases/latest
[license-image]: https://img.shields.io/github/license/bromite/bromite.svg
[license-url]: https://github.com/bromite/bromite/blob/master/LICENSE
