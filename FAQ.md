# Frequently Asked Questions

## Does Google Sync/Translate/Data Saver work?
No. This is not a limitation of Cromite but of all Chromium-based projects in general, as the general public is not allowed to use Google's APIs for free unless when using Chrome. Additionally, these features would not be privacy-friendly.

## Does Cromite require root?
No.

## Is Cromite de-googled?
Yes, although this has not been verified (and hardly can be) under all situations; if you were to find connections to cloud-based services please report them via the issue tracker.
Cromite uses [ungoogled-chromium's python script](https://github.com/Eloston/ungoogled-chromium/blob/master/utils/domain_substitution.py) to disable URLs in the codebase.
Other projects which follow a strict approach on this include [Iridium](https://iridiumbrowser.de/).

## Does Cromite support DRM media?
Yes, in order to play protected/encrypted media content the browser will use Android's DRM media framework to automatically negotiate access (same as Chromium).
This means for example that requests to Android license servers will be performed (`www.googleapis.com`), see https://w3c.github.io/encrypted-media/#direct-individualization.
To disable this functionality you should disable protected content playback from Site settings -> Protected Content.

## What is the SystemWebView?
It is the core component of Android for all web page visualizations. For example when you access a new wifi network and need to activate it, that is using the SystemWebView. Cromite does not currently offer a SystemWebView apk and there are no plans to do so (see [issue 62](https://github.com/uazo/bromite-buildtools/issues/62)).

## How to enable DNS-over-HTTPS?

DNS-over-HTTPS (DoH) is enabled by default in opportunistic mode (same as upstream Chromium); it is advised to choose a provider instead in order to use explicit mode. Enable DoH from Settings -> Privacy and Security -> Use Secure DNS -> Choose another provider and then enter the DoH template URL.

## Can you add HTTPS Everywhere?
Cromite does not support add-ons. However you can achieve the same effect via Settings -> Privacy and Security -> Always use secure connections

## Is Cromite on Play Store?
No, and this is not going to change. Many limitations apply for submissions there, including which ads are allowed to be blocked. Cromite favors user freedom in software choice.

## Is Cromite on F-Droid?
It is not on the official (default) F-Droid repository. This repository only accepts apps that the F-Droid maintainers can build from source, with a strict policy against including any non-FOSS binary blobs or native libraries, thus making it near impossible for any Chromium-based browser to be accepted - see [here](https://forum.f-droid.org/t/chromium-base-browser-or-bromite-in-main-f-droid-repo/17220/9) for further details. 
You can however use the F-Droid client to install and receive updates via [the official Cromite F-Droid repository](https://www.cromite.org/fdroid/repo).

## Does Cromite support WebRTC?
Partially, with mitigations to minimise IP leaks. 

## Using Cromite will favour the monopoly of the Chromium/Blink engine, why do you develop and maintain Cromite?
In short, to show what a Chromium-based engine could do **for the user** if the user experience and needs were the main focus of modern browser design.

For an Android browser using an alternative engine see [Fennec F-Droid](https://f-droid.org/en/packages/org.mozilla.fennec_fdroid/).

## Does Cromite support extensions?
No. Cromite does however integrate Adblock Plus functionality and has experimental support for Greasemonkey-style userscripts.

## Why do push notifications not work on this website?

The [Chromium Blink engine](https://www.chromium.org/blink) uses [GCM](https://en.wikipedia.org/wiki/Google_Cloud_Messaging) to deliver messages
when websites use the [Push API](https://w3c.github.io/push-api/); this will not work in Cromite because cloud integrations are disabled (GCM in this case).

[ServiceWorker notifications](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification) do work instead since they use
[android.app.Notification](https://developer.android.com/guide/topics/ui/notifiers/notifications).

## Can PWAs be installed?

PWAs are only supported as home shortcuts; WebAPKs will not work because they are generated server-side on googleapis.com (which is not allowed in Cromite).

## Does Cromite support the Android autofill framework?

Yes, Cromite uses the native Android autofill framework.

## Does Cromite support casting media content?

No, this would require Play Store binary blobs.

## Can you add this search engine as default?
No. Cromite does not make any choice related to default search engines, the Chromium defaults are used.
Some Android browsers receive commissions to ship their apps with a specific default search engine. Cromite does not receive any fee from anyone.
Changing the default search engine would lead to an endless series of requests to change it based on personal preferences.
You can manually add any search engine that supports OpenSearch. Visit the search engine home page, then under Settings -> Search Engine you should see the option to pick that search engine as your default search provider.


