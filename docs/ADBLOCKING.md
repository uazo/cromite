# Cromite AdBlock engine

## Modified version of Adblock Plus integrated in Cromite

Cromite uses a modified version of Adblock Plus.

Some Adblock Plus rules cannot be used:
- removed support for header and csp filter option
- removed support for json-override, simulate-event-poc, simulate-mouse-event snippets
- allowed the use of override-property-read by eliminating the possibility of specifying a number as an argument (except 0 and 1)
- removed support for sitekey

Some improvements have been included:
- Added DNS CNAME support
- Block of WebSockets and WebTransport urls
- Block of service workers fetchs

All default filters are downloaded from www.cromite.org/filters urls. You can enter your lists via the settings: http url redirection is prohibited.

### Update mechanism

The Cromite AdBlock Update Service checks every day if new filters are published.

www.cromite.org does not record any logs.

## Legacy bromite adblock engine

Since v77 Bromite uses [Chromium subresource filter](https://github.com/chromium/chromium/tree/master/components/subresource_filter).

This engine does not currently support CSS rules; as a result some sites will show ads.

In Cromite it is disabled by default.

### Update mechanism

The Bromite AdBlock Update Service checks at startup (after 5 seconds) and periodically (every week) if new filters are published.

### Original Bromite AdBlock engine
The ad-blocking engine of Bromite till v76 was an improved version of the original engine of [NoChromo](https://forum.xda-developers.com/android/apps-games/app-nochromo-w)

