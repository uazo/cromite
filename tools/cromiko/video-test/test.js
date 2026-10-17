// Tests the video player page script (cromiko_video.js in
// CromIKO-Video-Player.patch) in headless Chromium like CromikoVideoPlayer.java
// runs it: in an isolated world of every frame, with real touch events on a
// phone-sized screen, on a fake video site (server.py) with an ad layer over
// the video, a pop-under script, a player in a frame of another origin and a
// strict Content Security Policy.
//
// Usage (needs Python 3, ffmpeg, Node.js and Playwright with Chromium):
//   tools/cromiko/video-test/make_media.sh
//   python3 tools/cromiko/video-test/server.py 8775 8776 &
//   node tools/cromiko/video-test/test.js [path/to/cromiko_video.js]
// Screenshots are written to tools/cromiko/video-test/out/.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = Number(process.env.PORT || 8775);
const BASE = 'http://127.0.0.1:' + PORT;
const PATCH = path.join(__dirname, '../../../build/patches/CromIKO-Video-Player.patch');
const SOURCE = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : scriptFromPatch();

// The script as added by the patch.
function scriptFromPatch() {
  const lines = fs.readFileSync(PATCH, 'utf8').split('\n');
  const start = lines.indexOf('+++ b/chrome/android/java/res/raw/cromiko_video.js');
  const out = [];
  for (let i = start + 2; i < lines.length && !lines[i].startsWith('diff --git'); i++) {
    if (lines[i].startsWith('+')) out.push(lines[i].slice(1));
  }
  return out.join('\n') + '\n';
}
const OUT = path.join(__dirname, 'out');
const W = 412;
const H = 860;

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-features=IsolateOrigins,site-per-process'],
  });
  const context = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error' || /Refused|Content Security/.test(m.text())) consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(String(e)));
  const cdp = await context.newCDPSession(page);

  // An isolated world per frame, like ISOLATED_WORLD_ID_CHROME_INTERNAL.
  let worlds = new Map();
  async function newWorlds() {
    worlds = new Map();
    const tree = await cdp.send('Page.getFrameTree');
    const walk = async (node, depth) => {
      const r = await cdp.send('Page.createIsolatedWorld', { frameId: node.frame.id, worldName: 'cromiko' });
      worlds.set(depth === 0 ? 'main' : 'frame' + worlds.size, r.executionContextId);
      for (const child of node.childFrames || []) await walk(child, depth + 1);
    };
    await walk(tree.frameTree, 0);
  }
  async function run(command, where = 'main') {
    const args = JSON.stringify(command) + ', null, null';
    const r = await cdp.send('Runtime.evaluate', {
      expression: SOURCE.replace('__CROMIKO_ARGS__', args), contextId: worlds.get(where), returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return JSON.parse(r.result.value);
  }
  async function runWith(command, options, where = 'main') {
    const args = JSON.stringify(command) + ', ' + JSON.stringify(options) + ', null';
    const r = await cdp.send('Runtime.evaluate', {
      expression: SOURCE.replace('__CROMIKO_ARGS__', args), contextId: worlds.get(where), returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return JSON.parse(r.result.value);
  }
  // Evaluates in the isolated world of the main frame (where the player is).
  async function evalIn(expression, where = 'main') {
    const r = await cdp.send('Runtime.evaluate', { expression, contextId: worlds.get(where), returnByValue: true });
    if (r.exceptionDetails) throw new Error(expression + ' ' + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  const video = (prop, where) => evalIn('document.querySelector("video, audio").' + prop, where);

  async function touch(type, points) {
    await cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: points.map(([x, y], id) => ({ x, y, id })),
    });
  }
  async function tap(x, y) {
    await touch('touchStart', [[x, y]]);
    await sleep(40);
    await touch('touchEnd', []);
  }
  async function doubleTap(x, y) {
    await tap(x, y);
    await sleep(90);
    await tap(x, y);
  }
  async function swipe(x0, y0, x1, y1, steps = 10) {
    await touch('touchStart', [[x0, y0]]);
    for (let i = 1; i <= steps; i++) {
      await sleep(16);
      await touch('touchMove', [[x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps]]);
    }
    await sleep(30);
    await touch('touchEnd', []);
  }
  const display = (selector) => page.$eval(selector, e => getComputedStyle(e).display);
  const state = (where) => run('state', where);
  async function hideControls() {
    if ((await state()).controls) {
      await tap(W / 2, H * 0.3);
      await sleep(450);
    }
  }
  async function showControls() {
    if (!(await state()).controls) {
      await tap(W / 2, H / 2);
      await sleep(450);
    }
  }

  // --- Small button on the video --------------------------------------------
  await page.goto(BASE + '/watch.html');
  await page.waitForLoadState('load');
  await newWorlds();
  await evalIn('new Promise(r => { const v = document.querySelector("video"); v.readyState >= 1 ? r() : v.onloadedmetadata = r; })');
  check('scan puts one button on the video', (await run('scan')).state === 'scanning' && (await state()).buttons === 1);
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, '1-button.png') });

  const box = await page.locator('video').boundingBox();
  await tap(box.x + box.width - 8 - 19, box.y + 8 + 19);
  await sleep(800);
  check('tapping the button opens the player', (await state()).state === 'playing');
  check('the tap did not reach the site', (await page.evaluate(() => window.popups)) === 0,
        await page.evaluate(() => window.popups));
  check('header hidden', (await display('header')) === 'none');
  check('ad overlay and site controls hidden',
        (await display('.overlay-ad')) === 'none' && (await display('.site-controls')) === 'none');
  check('sticky ad hidden', (await display('.sticky')) === 'none');
  const rect = await page.$eval('video', e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); });
  check('video covers the screen', rect.join() === [0, 0, W, H].join(), rect);
  check('site controls attribute off', (await video('controls')) === false);
  await sleep(1000);
  check('video plays', (await video('paused')) === false && (await video('currentTime')) > 0.3);
  await page.screenshot({ path: path.join(OUT, '2-player.png') });

  // --- Taps -----------------------------------------------------------------
  // Away from the buttons in the middle of the screen.
  await tap(W / 2, H * 0.3);
  await sleep(450);
  const c1 = (await state()).controls;
  await tap(W / 2, H * 0.3);
  await sleep(450);
  const c2 = (await state()).controls;
  check('a tap shows and hides the controls', c1 !== c2, [c1, c2]);

  let t0 = await video('currentTime');
  await doubleTap(W - 60, H / 2);
  await sleep(150);
  let t1 = await video('currentTime');
  check('double tap on the right: +10 s', t1 - t0 > 9 && t1 - t0 < 11.5, [t0, t1]);
  await page.screenshot({ path: path.join(OUT, '3-double-tap.png') });
  await sleep(900);

  t0 = await video('currentTime');
  await doubleTap(60, H / 2);
  await sleep(150);
  t1 = await video('currentTime');
  check('double tap on the left: -10 s', t0 - t1 > 8.5 && t0 - t1 < 11, [t0, t1]);
  await sleep(900);

  t0 = await video('currentTime');
  await doubleTap(W - 60, H / 2);
  await sleep(120);
  await tap(W - 60, H / 2);
  await sleep(120);
  t1 = await video('currentTime');
  check('more taps after a double tap keep seeking: +20 s', t1 - t0 > 19 && t1 - t0 < 21.5, [t0, t1]);
  await sleep(900);

  await hideControls();
  const wasPaused = await video('paused');
  await doubleTap(W / 2, H / 2);
  await sleep(200);
  check('double tap in the middle: pause', (await video('paused')) !== wasPaused);
  // Paused, the controls stay on screen: the play button is in the middle.
  await tap(W / 2, H / 2);
  await sleep(300);
  check('play button in the middle: play', (await video('paused')) === wasPaused);

  // Hold for 2x.
  await hideControls();
  await touch('touchStart', [[W / 2, H / 2]]);
  await sleep(800);
  const holdRate = await video('playbackRate');
  await page.screenshot({ path: path.join(OUT, '4-hold-2x.png') });
  await touch('touchEnd', []);
  await sleep(150);
  check('hold: 2x while holding, back to 1x after', holdRate === 2 && (await video('playbackRate')) === 1,
        [holdRate, await video('playbackRate')]);
  await sleep(500);

  // Swipe sideways to seek: half the screen of a 90 s video moves 60 s... the
  // range is min(duration, 120) = 90 s, so 200 px of 412 is about +43.7 s.
  await evalIn('document.querySelector("video").currentTime = 10');
  await sleep(300);
  await hideControls();
  t0 = await video('currentTime');
  await swipe(100, H / 2, 300, H / 2, 12);
  await sleep(200);
  t1 = await video('currentTime');
  check('swipe sideways seeks', t1 - t0 > 38 && t1 - t0 < 48, [t0, t1]);

  // Volume and brightness.
  await evalIn('document.querySelector("video").volume = 0.3');
  await swipe(W - 80, 600, W - 80, 300, 10);
  await sleep(100);
  const vol = await video('volume');
  check('swipe up on the right: louder', vol > 0.75, vol);
  await swipe(80, 300, 80, 600, 10);
  await sleep(100);
  const filter = await video('style.filter');
  check('swipe down on the left: darker', /brightness\(0\.[0-6]/.test(filter), filter);
  await swipe(80, 600, 80, 300, 10);
  await sleep(600);

  // Pinch to zoom.
  await touch('touchStart', [[180, 430], [232, 430]]);
  for (let i = 1; i <= 8; i++) {
    await sleep(16);
    await touch('touchMove', [[180 - i * 12, 430], [232 + i * 12, 430]]);
  }
  await touch('touchEnd', []);
  await sleep(200);
  check('pinch out: zoom to fill', (await video('style.objectFit')) === 'cover', await video('style.objectFit'));
  await page.screenshot({ path: path.join(OUT, '5-zoomed.png') });

  // --- Buttons ----------------------------------------------------------------
  await showControls();
  await page.screenshot({ path: path.join(OUT, '6-controls.png') });
  // Speed menu: the speed button is the second of the top right buttons
  // (subtitles, speed, more, close; picture in picture is not available here).
  // Buttons are 44 px wide from the right edge: close, more, (pip), speed, cc.
  const right = (i) => W - 8 - 22 - i * 48;
  const pipHidden = !(await evalIn('document.pictureInPictureEnabled'));
  const speedIndex = pipHidden ? 2 : 3;
  await tap(right(speedIndex), 8 + 22);
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, '7-speed-menu.png') });
  // Menu items are 44 px tall from the bottom of the menu (bottom 76 px), in
  // the order 0.25 ... 3: 1.5x is the 6th of 10.
  const menuBottom = H - 76 - 6;
  const itemY = (i, count) => menuBottom - (count - i) * 45 + 22;
  await tap(W - 8 - 100, itemY(5, 10));
  await sleep(300);
  check('speed menu sets 1.5x', (await video('playbackRate')) === 1.5, await video('playbackRate'));

  await showControls();
  await tap(right(speedIndex + 1), 8 + 22);
  await sleep(300);
  check('subtitles button shows the subtitles',
        (await evalIn('document.querySelector("video").textTracks[0].mode')) === 'showing');

  await showControls();
  await tap(right(1), 8 + 22);
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, '8-more-menu.png') });
  await tap(W - 8 - 100, itemY(2, 3));
  await sleep(300);
  check('sleep timer: 15 min', (await state()).sleepMinutes === 15, (await state()).sleepMinutes);

  // Lock.
  await showControls();
  const lockX = W - 8 - 22 - 2 * 48;
  await tap(lockX, H - 8 - 22);
  await sleep(300);
  check('lock', (await state()).locked === true);
  t0 = await video('currentTime');
  await doubleTap(W - 60, H / 2);
  await sleep(300);
  t1 = await video('currentTime');
  check('locked: double tap does not seek', Math.abs(t1 - t0) < 2, [t0, t1]);
  await page.screenshot({ path: path.join(OUT, '9-locked.png') });
  await tap(W / 2, H * 0.82 - 28 + 28);
  await sleep(100);
  // The unlock button is shown after a tap, at 18 % from the bottom.
  await tap(W / 2, H - H * 0.18 - 28);
  await sleep(300);
  check('unlock', (await state()).locked === false);

  // Close with the button.
  await showControls();
  await tap(right(0), 8 + 22);
  await sleep(400);
  check('close restores the page', (await state()).state === 'scanning' && (await display('header')) !== 'none' &&
        (await display('.overlay-ad')) !== 'none');
  check('site controls attribute restored', (await video('controls')) === false);
  check('button is back after closing', (await state()).buttons === 1);
  check('no taps reached the site while in the player', (await page.evaluate(() => window.popups)) === 0,
        await page.evaluate(() => window.popups));

  // Continue where you stopped.
  await evalIn('document.querySelector("video").currentTime = 42');
  const probe = await run('probe');
  check('probe scores the main video', probe.score > 1 && typeof probe.token === 'string', probe);
  check('open with another frame\'s token does nothing', (await runWith('open', {token: 'other'})).opened === false);
  check('menu "open" opens the main video', (await runWith('open', {token: probe.token})).opened === true);
  await sleep(300);
  await run('close');
  await evalIn('document.querySelector("video").currentTime = 0');
  await run('open');
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, '10-resume.png') });
  await tap(16 + 80, H - 96 - 20);
  await sleep(300);
  const resumed = await video('currentTime');
  check('continue chip jumps to the saved position', resumed >= 41 && resumed < 46, resumed);
  await run('close');

  // --- A player in a frame of another origin ---------------------------------
  await page.goto(BASE + '/iframe.html');
  await page.waitForLoadState('load');
  await sleep(800);
  await newWorlds();
  check('page with a frame: two worlds', worlds.size === 2, [...worlds.keys()]);
  const probes = [await run('probe', 'main'), await run('probe', 'frame1')];
  check('probe: only the frame has a video', probes[0].score === 0 && probes[1].score > 0, probes);
  await run('scan', 'main');
  await run('scan', 'frame1');
  check('no button in the main frame', (await state('main')).buttons === 0);
  check('button in the frame', (await state('frame1')).buttons === 1);
  await page.screenshot({ path: path.join(OUT, '11-frame-button.png') });
  const frameBox = await page.locator('iframe').boundingBox();
  await tap(frameBox.x + frameBox.width - 8 - 19, frameBox.y + 8 + 19);
  await sleep(700);
  check('player opens in the frame', (await state('frame1')).state === 'playing');
  const framePopups = await page.frames()[1].evaluate(() => window.popups);
  check('the tap did not reach the framed site', framePopups === 0, framePopups);
  await page.screenshot({ path: path.join(OUT, '12-frame-player.png') });
  await run('close', 'frame1');

  // --- Audio --------------------------------------------------------------------
  await page.goto(BASE + '/music.html');
  await page.waitForLoadState('load');
  await page.evaluate(() => document.querySelector('audio').play());
  await sleep(500);
  await newWorlds();
  await run('scan');
  check('playing audio gets a floating button', (await state()).buttons === 1);
  await page.screenshot({ path: path.join(OUT, '13-audio-button.png') });
  await tap(W - 16 - 19, H - 96 + 19);
  await sleep(600);
  const audioState = await state();
  check('audio player with the mascot', audioState.state === 'playing' && audioState.audio === true, audioState);
  await page.screenshot({ path: path.join(OUT, '14-audio-player.png') });
  await run('close');

  // --- Decorative background video: no button ---------------------------------
  await page.goto(BASE + '/background.html');
  await page.waitForLoadState('load');
  await sleep(500);
  await newWorlds();
  await run('scan');
  check('no button on a muted looping background video', (await state()).buttons === 0);

  check('no console errors or CSP refusals', consoleErrors.length === 0, consoleErrors);
  await browser.close();
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
