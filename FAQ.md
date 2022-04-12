# Frequently Asked Questions

## Does Google Sync/Translate/Data saver work?
No.
This is not a limitation of Bromite but of all Chromium-based projects in general, as general public is not allowed to use Google's APIs for free unless when using Chrome.

Additionally, these features would not be privacy-friendly.

## Does Bromite require root?
No.

## Is Bromite de-googled?

Yes, although this has not been verified (and hardly can be) under all situations; if you were to find connections to cloud-based services please report them via the issue tracker.
Bromite uses [ungoogled-chromium's python script](https://github.com/Eloston/ungoogled-chromium/blob/master/utils/domain_substitution.py) to disable URLs in the codebase since version `78.0.3904.93`.

Projects which follow a strict approach on this are [Iridium](https://iridiumbrowser.de/) and [Inox patchset](https://github.com/gcarq/inox-patchset).

## Does Bromite support DRM media?

Yes, in order to play protected/encrypted media content the browser will use Android's DRM media framework to automatically negotiate access (same as Chromium).
This means for example that requests to Android license servers will be performed (`www.googleapis.com`), see https://w3c.github.io/encrypted-media/#direct-individualization
To disable this functionality you should disable protected content playback from Site settings -> Protected Content.

## What is the SystemWebView?
It is the core component of Android for all web page visualizations. For example when you access a new wifi network and need to activate it, that is using the SystemWebView. If you do not know what it is then you do not need to install it.

See also [the wiki page](https://github.com/bromite/bromite/wiki/Installing-SystemWebView) for community-contributed installation instructions.

Ad-blocking was present and always enabled in the SystemWebView from version `72.0.3626.120` till version `77.0.3865.104`, when it stopped working due to [upstream NetworkService changes](https://docs.google.com/document/d/1TZEuPvr2KAbP4_TZpuuwtEEArQsyAkc2HDu68l66YwU/edit?ts=598244df#heading=h.ougoi5i6508y).

## How to enable DNS-over-HTTPS?

See [this page](https://www.bromite.org/doh).

## Can you add HTTPS everywhere?
No.
We cannot add add-ons to Bromite (merely some features).

## Is Bromite on Play Store?
No, and this is unlikely to change. Many limitations apply for submissions there, including which ads are allowed to be blocked.

Bromite favors user freedom in software choice: the device is yours so you get to choose which software to run on it, end of the story.

## Is Bromite on F-Droid?
It is not on the official F-Droid repository and there are no (more) plans to submit it.

You can use F-Droid client to install and receive updates via [the official Bromite F-Droid repository](https://www.bromite.org/fdroid).

## Does Bromite support WebRTC?
Partially, see https://github.com/bromite/bromite/wiki/WebRTC

## Using Bromite will favour the monopoly of the Chromium/Blink engine, why do you develop and maintain Bromite?
In short, to show what a Chromium-based engine could do **for the user** if the user experience and needs were the main focus of modern browser design.

For an Android browser using an alternative engine see [Fennec F-Droid](https://f-droid.org/en/packages/org.mozilla.fennec_fdroid/).

## Does Bromite support extensions?
No; Bromite will support extensions only if upstream (Chromium) does, or similarly another project maintains the patch and functionality.

## Why do push notifications not work on this website?

The [Chromium Blink engine](https://www.chromium.org/blink) uses [GCM](https://en.wikipedia.org/wiki/Google_Cloud_Messaging) to deliver messages
when websites use the [Push API](https://w3c.github.io/push-api/); this will not work in Bromite because cloud integrations are disabled (GCM in this case).

[ServiceWorker notifications](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification) do work instead since they use
[android.app.Notification](https://developer.android.com/guide/topics/ui/notifiers/notifications).

## Can PWAs be installed?

PWAs are only supported as home shortcuts; WebAPKs will not work because they are generated server-side on googleapis.com (which is not allowed in Bromite).

## Does Bromite support the Android autofill framework?

Yes, since version 94.0.4606.109 the native Android autofill can be used; this does not require accessibility services as a workaround.

## Does Bromite support casting media content?

No, this would require Play Store binary blobs.

## Can you add this search engine as default?
No.
Bromite does not make any choice related to default search engines, the Chromium default is used.
Various Android browsers get some fee to ship their apps with a specific default search engine, Bromite does not get any fee from anyone.
Changing the default search engine would lead to an endless series of requests to change it based on personal preferences, thus no change is made to the default.
See also: https://github.com/bromite/bromite/wiki/SearchEngines

## Some sites show ads, how can I fix this?
You can compare the blocked URLs with a desktop browser and Bromite (using [remote debugging](https://developer.chrome.com/docs/devtools/remote-debugging/)) and figure out some new filter rules to be added.
If the ads are blocked via cosmetic filtering then blocking them is not possible with Bromite's engine and you might need something like an [user script](https://github.com/bromite/bromite/wiki/UserScripts) instead.
See also: https://github.com/bromite/bromite/wiki/AdBlocking
