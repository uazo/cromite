// ==UserScript==
// @name         Allow playing videos in background
// @version      1.1.0
// @description  Allow playing youtube and vimeo videos in background in cromite. Original Javascript code by timdream and csagan5
// @author       uazo
// @match        https://*.youtube.com/*
// @match        https://*.youtube-nocookie.com/*
// @match        https://*.vimeo.com/*
// @match        https://sp.nicovideo.jp/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    window.addEventListener(
        'visibilitychange', evt => evt.stopImmediatePropagation(), true);

    // Fullscreen API
    const IS_VIMEO = window.location.hostname.search(/(?:^|.+\\.)vimeo.com/) > -1;
    if (IS_VIMEO) {
        window.addEventListener(
            'fullscreenchange', evt => evt.stopImmediatePropagation(), true);
    }
})();
