# Features

#### Anti fingerprinting
- Disable Battery API by default (https://www.w3.org/TR/battery-status/#security-and-privacy-considerations)
- Disable Client hints API (https://wicg.github.io/client-hints-infrastructure/#privacy)
- Disable ComputePressure API by default (https://www.w3.org/TR/compute-pressure/#security-and-privacy-considerations)
- Disable variations and field trials (activation, fetch and report to the sites)
- Disable Compression Dictionary Transport (https://github.com/WICG/compression-dictionary-transport?tab=readme-ov-file#fingerprinting)
- Disable Beacon API (https://w3c.github.io/beacon/#privacy-and-security) and FetchLater API (https://chromestatus.com/feature/4654499737632768)
- Disable CSS blink-feature() support
- Disable DRM media
- Disable FedCm (https://w3c-fedid.github.io/FedCM/#privacy)
- Disable GetInstalledRelatedApps API (https://wicg.github.io/get-installed-related-apps/EXPLAINER.html)
- Disable Idle Detection (https://wicg.github.io/idle-detection/#security-and-privacy)
- Disable prefers-reduced-transparency media query (https://groups.google.com/a/mozilla.org/g/dev-platform/c/l410J8odZjA)
- Disable remote altsvc for h3 connections on non-443 port
- Disable SpeechSynthesis API
- Disable support for pointer device id (https://groups.google.com/a/chromium.org/g/blink-dev/c/3eU-AHH8x4k)
- Disable TLS resumption (https://arxiv.org/abs/1810.07304)
- Disable UA full version and getHighEntropyValues() API
- Disable visited pseudo class
- Disable WebGPU
- Disable GamePad API by default (https://www.w3.org/TR/gamepad/#fingerprinting-mitigation)
Also disable gamepadconnected and gamepaddisconnected, see https://jshelter.org/gp/
- Disable WebGL by default
- Disable WebRTC by default
- Disable MIDI permission by default
- Enable Canvas and Rect API fingerprinting mitigations
- Enable Media API fingerprinting mitigations
- AudioBuffer and AnalyserNode fingerprinting mitigations (https://fingerprint.com/blog/audio-fingerprinting/)
- Hardening against incognito mode detection
- Partition MediaDevice id by default
- Override navigator.language API
- Override navigator.connection info
- Override device memory and cpu
- Allow specifying a custom timezone, or using a random one
- Viewport Protection site setting
- Warning message for unsupported hardware aes
- Do not expose local IP addresses with webRTC
- Allows the use of the api DocumentPiP only with the content setting popup allowed (https://wicg.github.io/document-picture-in-picture/#privacy-considerations)
- Multi-Screen Window Placement API fix (screen.isExtended)
- Disable Posture API by default (https://github.com/w3c/device-posture/blob/gh-pages/security-privacy-self-assessment.md)
- Disables the ability to retrieve the user-set caret blink setting.
- Disables the ability to retrieve the actual screen frame rate
- (ANDROID) Do not follow night mode for dark mode preference when theme is set to system default
- (DESKTOP) Enable HighEfficiencyMode by default
- (DESKTOP) Enable percent based scrolling for mousewheel
- (DESKTOP) Enable Keyboard Layout API mitigation
- (WINDOWS) Disable Windows ClearType Text Tuner setting (active in rdp sessions)
- (WINDOWS) Hide the presence of the webcam if the user has not given permission
- (WINDOWS) PublicKeyCredential fingerprinting mitigations, see #1758
- (DESKTOP) Disable Bluetooth API by default
- (WINDOWS) Disable the use of non-standard and local fonts
- (ANDROID) Replaces system fonts with a predefined set (https://github.com/uazo/cromite/issues/1829)

#### Tracking navigation
- Enable network isolation features
- Enable third-party storage partitioning
- Partition all cookies by top frame domain (like Firefox Total Cookie Protection)
- Partition Blink memory cache (http://crbug.com/1127971)
- Partition blob urls by top frame URL
- Partition HSTS cache by NAK
- Disable use of SameSite=None cookies in A/B/A contexts (like Firefox)
- Private network access content settings
- Reduce HTTP headers in DoH requests to bare minimum
- Remove Auth header upon cross origin redirect
- Remove HTTP referrals in cross origin navigation
- Remove window name on cross origin navigation

#### Privacy
- Ignore enterprise policies
- Disable media router and remoting by default
- Disable text fragments by default
- Disable voice recognition integration
- Disable custom tab intents by default
- Disable external intent requests by default and Android App Scheme as referrer
Blocks the possibility of tying online browsing with in-app browsing and viceversa
- Disable site engagement by default
Site engagement is a kind of internal chromium log to score the sites the user visits. The score is used internally to automatically grant permissions to sites.
Disabling it by default allows the user to choose each time how the browser should behave.
- Disable reporting API by default (https://w3c.github.io/reporting/#privacy)
- Disable preconnect and prerender features (they activate connections without the explicit consent of the user)
- Disable browser-integrated AI and segmentation platform features by default (they profile the user)
- Disable AsyncDNS by default
- Disable BackForwardCache (as per-document state/data as well as sticky activation might persist after navigation)
- Disable Ads conversion measurement api and Google Privacy Sandbox
- Disable requests for single-word Omnibar searches
- Disable Service and Shared workers on 3P iframe (like firefox)
- Disable QR code sharing
- Disable WebView MediaIntegrity Api (https://android-developers.googleblog.com/2023/11/increasing-trust-for-embedded-media.html)
- Disable signed exchange features (https://developers.google.com/search/docs/appearance/signed-exchange)
- Disable annotate downloads by url
- Enable Do-Not-Track by default
- Enable Global Privacy Control by default
- Enable cleaning of the CORS Preflight Cache on restart
- Disable Device Attributes API 
- (ANDROID) Remove SMS integration
- (ANDROID) Never use HTTP probes for connection detection
- (ANDROID) Disable auto fetch of offline content when browser go online
- (ANDROID) Disable the DIAL repeating discovery
- (ANDROID) Disable smart text selection by default
- (ANDROID) Disable Accessibility service by default
- (ANDROID) Disable integration with Android Compose feature
- (ANDROID) Add option to disable snapshots of pages on disk in all modes, including incognito browsing (default off)
- (ANDROID) Add option not to reopen tabs between sessions
- (ANDROID) Add setting to clear data between restarts
- (ANDROID) Allow user choice to allow camera/microphone/geolocation access only once or until the page is closed or until the device is closed
- (ANDROID) Close sessions on ip change, changed from automatic reconnection
- (DESKTOP) Disable the use of remote endpoint and custom protocols for developer tools

#### Google related
- Disable sending url-keyed data collection to Google
- Disable Google ContextualSearch
- Disable Google Translate
- Disable Google Browser Signin
- Disable Google Sync
- Disable report metrics to Google
- Disable Google DNS address used for IPv6 probes (use RIPE DNS)
- Disable Google Component Updates
- Disable send-settings on profile-resetter
- Disable webRTC log uploader
- Disable integration with google urls
- Disable Google feeds support by default
- Disable Network Time Tracker
- Ignore any partner-provided and search engine home page
- Disable Google autofill server by default
- Disable automatic crash reporting and feeback collector
- Disable NTP remote suggestions by default
- Disable privacy issues in password manager (Affiliation service)
- Disable translations and ranker fetcher
- Disable remote service for geolocation
- Remove binary blob (google play services) integrations
- Remove references to fonts.googleapis.com from ReadAnything and Distiller
- (ANDROID) Disable barcode, face and text detection APIs via google play services
- (ANDROID) Disable GSA by default (googlequicksearchbox, GoogleAppActivity, Lens, Voice Assist)
- (ANDROID) Disable Google PrivacyGuide and Google SafetyCheck
- (ANDROID) Remove preload of com.google.android.gms.fonts
- (ANDROID) Disable use of gms for geolocation
- (ANDROID) Do not store passwords by default in google play services
- (DESKTOP) Remove Google Accounts private API
- (DESKTOP) Does not allow the Chrome web store to know the list of installed extensions

#### Enhancements
- Proxy configuration page (chrome://proxy) (https://chromium.googlesource.com/chromium/src/+/HEAD/net/docs/proxy.md)
- Add a Google search engine that forces languages to English, disable from all its searches RLZ and field experiments querystring parameters.
- Add DuckDuckGo Lite
- Add support to jxl
- Add history number of days privacy setting
- Block gateway attacks via websockets
- Built-in Adblock
- Enable blocking of all pop-ups
- Enable platform aac audio and h264 video due to licence restrictions
- Enable HEVC by default
- Enable an internal firewall to block unauthorised calls made from the browser (normally to google servers)
- Enable jxl
- Disable parental control by default
- Crash reports UI
- Remove detection of captive portals
- Site settings for autoplay, cookies, javascript, images and adblock
- Use BoringSSL for RandBytes to overcome the lack of entropy for the internal generator in some android devices
- User agent customization
- (ANDROID) Always-incognito mode
- (ANDROID) Add flag to disable vibration api
- (ANDROID) Disable the LowEndDeviceMode experiment in devices with 4-6 gb of ram.
- (ANDROID) Enable share intent
- (ANDROID) User scripts support
- (DESKTOP) Enable deactivation of the js debugger statement
- (DESKTOP) Enable support for ManifestV2

#### Security
- Enable StrictOriginIsolation and SitePerProcess by default
- Boost internal gwp asan checks and opt-in android gwpAsanMode (https://developer.android.com/ndk/guides/gwp-asan)
- Enable DOH secure mode by default
- Enable Certificate Transparency by default
- Enable Document Open Inheritance and CookieURL Removal (https://docs.google.com/document/d/1_89X4cNUab-PZE0iBDTKIftaQZsFbk7SbFmHbqY54os/edit)
- Disable JIT by default
- Disable undocumented Manta and Orca services
- (ANDROID) Disable UserCertificates by default
Prevents the unauthorised use by the user of proxies or man-in-the-middle attacks and bugs such as https://issues.chromium.org/issues/40089326
- (ANDROID) Add flag allowing the blocking of all non-https connections (default off)
- (ANDROID) Browser auto updater
- (ANDROID) Disable Android AppRestrictions
- (DESKTOP) Disable Google side panel search companion feature
- (WINDOWS) Enable file system access blocklist
- (WINDOWS) Improve the browser sandbox by enabling network service sandbox and CIG in windows
- (WINDOWS) Disable dynamic code using ACG by default

#### UI
- Disable all promo dialogs
- Disable omission of URL elements
- EV Certified appear as normal certificates (do not give users a false sense of extra security which is not there)
- (ANDROID) Allows the selection of all bookmarks
- (ANDROID) Allow playing audio in background by default
- (ANDROID) Add Alt+D hotkey to focus address bar
- (ANDROID) Add bookmark import/export actions
- (ANDROID) Add exit menu item
- (ANDROID) Add flags to disable omnibox search for browsing history
- (ANDROID) Add flag to control video playback resume feature: video playback whenever switching between tabs is not blocked
- (ANDROID) Add menu item to bookmark all tabs
- (ANDROID) Add menu item to view source
- (ANDROID) Add option to use home page as new tab page
- (ANDROID) Add setting to invert tap and long tap for accessibility reasons
- (ANDROID) Always open browser controls in new tab
- (ANDROID) Adds options related to the handling of pop-up selections: Opens tabs in foreground,  Move web search to the top of items, Web search in tab group and Enable smart text selection
- (ANDROID) Disable add to home screen prompt
- (ANDROID) Disable Paint Preview by default
- (ANDROID) Do not ignore download location prompt setting
- (ANDROID) Enable darken websites checkbox in themes (fingerprinting risk, activate with caution)
- (ANDROID) Enable improved bookmarks ui by default
- (ANDROID) Enable native Android autofill
- (ANDROID) Enable search engine settings desktop ui
- (ANDROID) Increase number of autocomplete matches to 10
- (ANDROID) Keep empty tabs between sessions
- (ANDROID) Disable screenshots in Incognito mode
- (ANDROID) Move navigation bar to bottom
- (ANDROID) Never fetch popular sites
- (ANDROID) Re-introduce modal dialog flag to close all tabs
- (ANDROID) Remove help menu item
- (ANDROID) Readded disable-pull-to-refresh-effect
- (ANDROID) Show New Tab Page at startup
- (ANDROID) Use list mode for tab switcher
- (DESKTOP) Enable menu on reload button

#### Disabled chromium feature
- SafeBrowsing and SafeBrowsing Extended Reporting
- (ANDROID) Commerce Hint and PriceTracking
- (ANDROID) Shopping List integration
- (ANDROID) DiscountInfo Api

#### Deprecated (they will be removed)
- Add flag for save-data-header (fingerprinting risk, activate with caution)
- Add flag to configure maximum connections per host
- Block Intents While Locked (active by default in chromium)
- Block 'qjz9zk' or 'trk:' requests (unused)
- Deprecate Data URL in SVGUseElement (enabled by default in chromium)
- Disable lock icon in address bar by default (enabled by default in chromium)
- Disable offline pages in CCT
- Enable Android Dynamic Performance Framework (enabled by default in chromium)
- Enable prefetch-privacy-changes by default (as they are disabled by default)
- Evict the entire FrameTree like desktop (enabled by default in chromium)
- Exit on failure of inclusion
- (ANDROID) Add option to force tablet UI
- (ANDROID) Allows you to keep the toolbar open at all times (disabled by default - fingerprinting risk, activate with caution)
- (WINDOWS) Lock Profile Cookie Database (enabled by default in chromium)

#### Experimental
- Ask to restart on connection change
- Dictionary suggestions for the Omnibox
