// Tests the manga mode page script (cromiko_manga.js in CromIKO-Manga-Mode.patch)
// in headless Chromium like CromikoMangaMode.java runs it: in an isolated world,
// with taps on a mobile viewport, on a fake manga site (server.py) that loads its
// images lazily or with a script, and has a strict Content Security Policy.
//
// Usage (needs Python 3, Node.js and Playwright with Chromium):
//   python3 tools/cromiko/manga-test/server.py 8765 &
//   node tools/cromiko/manga-test/test.js [path/to/cromiko_manga.js]
// Screenshots are written to tools/cromiko/manga-test/out/.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8765';
const PATCH = path.join(__dirname, '../../../build/patches/CromIKO-Manga-Mode.patch');
const SOURCE = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : scriptFromPatch();
const OUT = path.join(__dirname, 'out');

// The script as added by the patch.
function scriptFromPatch() {
  const lines = fs.readFileSync(PATCH, 'utf8').split('\n');
  const start = lines.indexOf('+++ b/chrome/android/java/res/raw/cromiko_manga.js');
  const out = [];
  for (let i = start + 2; i < lines.length && !lines[i].startsWith('diff --git'); i++) {
    if (lines[i].startsWith('+')) out.push(lines[i].slice(1));
  }
  return out.join('\n') + '\n';
}
const TEXTS = {
  stepNext: 'Tap the NEXT chapter button',
  stepPrev: 'Tap the PREVIOUS chapter button',
  stepImage: 'Tap a page of the chapter',
  skip: 'Skip', cancel: 'Cancel', notImage: 'That is not a picture, try again',
  prev: 'Previous chapter', next: 'Next chapter', close: 'Close manga mode',
  noNext: 'No next chapter', noPrev: 'No previous chapter',
};

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error' || /Refused/.test(m.text())) consoleErrors.push(m.text()); });
  const cdp = await context.newCDPSession(page);

  // One isolated world per document, like ISOLATED_WORLD_ID_CHROME_INTERNAL.
  let worldId = null;
  async function newWorld() {
    const tree = await cdp.send('Page.getFrameTree');
    const r = await cdp.send('Page.createIsolatedWorld', { frameId: tree.frameTree.frame.id, worldName: 'cromiko' });
    worldId = r.executionContextId;
  }
  async function run(command, config) {
    const args = JSON.stringify(command) + ',' + JSON.stringify(config || null) + ',' + JSON.stringify(TEXTS);
    const r = await cdp.send('Runtime.evaluate', {
      expression: SOURCE.replace('__CROMIKO_ARGS__', args), contextId: worldId, returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return JSON.parse(r.result.value);
  }
  async function poll() {
    const r = await cdp.send('Runtime.evaluate', {
      expression: "JSON.stringify(window.__cromikoManga ? window.__cromikoManga.run('poll') : {state: 'none'})",
      contextId: worldId, returnByValue: true,
    });
    return JSON.parse(r.result.value);
  }
  const center = async (selector, index = 0) => {
    const box = await page.locator(selector).nth(index).boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  // The buttons hide on a tap in full screen: show them before using them.
  async function showButtons() {
    if ((await run('state')).buttonsHidden) {
      await page.touchscreen.tap(200, 500);
      await sleep(300);
    }
  }
  const display = (selector) => page.$eval(selector, e => getComputedStyle(e).display);

  // --- Set up on chapter 2 ------------------------------------------------
  await page.goto(BASE + '/ch-2.html');
  await page.waitForLoadState('networkidle');
  await newWorld();
  check('pick starts', (await run('pick')).state === 'picking');
  await page.screenshot({ path: path.join(OUT, '1-pick-next.png') });

  // Step 1: the bottom next button (the tap lands on the icon inside it).
  await page.locator('.next_page .ico').nth(1).scrollIntoViewIfNeeded();
  let p = await center('.next_page .ico', 1);
  await page.touchscreen.tap(p.x, p.y);
  await sleep(150);
  check('next tap does not navigate', page.url().endsWith('/ch-2.html'), page.url());
  await sleep(500);

  // Step 2: previous button at the top.
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(100);
  p = await center('.prev_page', 0);
  await page.touchscreen.tap(p.x, p.y);
  await sleep(650);
  check('prev tap does not navigate', page.url().endsWith('/ch-2.html'));
  await page.screenshot({ path: path.join(OUT, '2-pick-image.png') });

  // Step 3: tap a logo first (not a chapter page? it is an image, so it would
  // be accepted) - instead tap the heading, which is not a picture.
  p = await center('h1');
  await page.touchscreen.tap(p.x, p.y);
  await sleep(200);
  check('still picking after tapping text', (await poll()).state === 'picking');

  // Now the second chapter image, through the transparent overlay.
  await page.locator('.page-break').nth(1).scrollIntoViewIfNeeded();
  await sleep(300);
  p = await center('.page-break .protect', 1);
  await page.touchscreen.tap(p.x, p.y);
  await sleep(400);
  const done = await poll();
  check('pick done with config', done.state === 'done' && !!done.config, done);
  const config = done.config;
  check('poll resets after done', (await poll()).state === 'idle');
  check('page click handlers did not run during picking',
        (await page.evaluate(() => [window.popunders, window.imageClicks || 0])).join() === '0,0',
        await page.evaluate(() => [window.popunders, window.imageClicks || 0]));

  // --- Reader on chapter 2 ------------------------------------------------
  await sleep(500);
  check('header hidden', (await display('.site-header')) === 'none');
  check('comments hidden', (await display('.comments')) === 'none');
  check('sidebar hidden', (await display('.sidebar')) === 'none');
  check('sticky ad hidden', (await display('.sticky-ad')) === 'none');
  check('nav hidden', (await display('.nav-links')) === 'none');
  const widths = await page.$$eval('.reading-content img', els => els.map(e => Math.round(e.getBoundingClientRect().width)));
  check('images full width', widths.every(w => w === 412), widths);
  check('scrolled to top', (await page.evaluate(() => window.scrollY)) === 0);
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, '3-reader-top.png') });

  // Progressive loading while scrolling down.
  const loadedAt = [];
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 700);
    await sleep(250);
    loadedAt.push(await page.$$eval('.reading-content img', els => els.filter(e => e.complete && e.naturalWidth > 100).length));
  }
  check('all chapter 2 images loaded', loadedAt[loadedAt.length - 1] === 8, loadedAt);
  const heights = await page.$$eval('.reading-content img', els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  check('loaded images keep their aspect ratio (800x2000 -> 412x1030)', heights.every(h => h === 1030), heights);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, '4-reader-scrolled.png') });

  // A tap on the chapter does not reach the site.
  p = { x: 200, y: 500 };
  await page.touchscreen.tap(p.x, p.y);
  await sleep(200);
  check('taps on the reader do not reach the site',
        (await page.evaluate(() => [window.popunders, window.imageClicks || 0])).join() === '0,0');

  // Next chapter: tap the second button at the top left.
  await showButtons();
  await page.touchscreen.tap(8 + 36 + 6 + 18, 8 + 18);
  await page.waitForURL(/ch-3\.html$/, { timeout: 5000 }).catch(() => {});
  check('next arrow opens chapter 3', page.url().endsWith('/ch-3.html'), page.url());
  await page.waitForLoadState('load');

  // --- Chapter 3: images are added by a script after loading ---------------
  await newWorld();
  const auto = await run('auto', config);
  check('auto waits for the asynchronous images', auto.state === 'waiting', auto);
  await sleep(2500);
  check('reader opened on chapter 3', (await run('state')).state === 'reading' &&
        (await display('.site-header')) === 'none');
  const loaded = () => page.$$eval('.reading-content img', els => els.filter(e => e.complete && e.naturalWidth > 100).length);
  const progress = [await loaded()];
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 700); await sleep(250); progress.push(await loaded()); }
  check('chapter 3 images all loaded', progress[progress.length - 1] === 6, progress);
  const ch3 = await page.$$eval('.reading-content img', els => els.map(e => [Math.round(e.getBoundingClientRect().width), e.complete && e.naturalWidth > 100]));
  check('chapter 3 images full width and loaded', ch3.length === 6 && ch3.every(([w, l]) => w === 412 && l), ch3);
  check('auto again on the same page is skipped', (await run('auto', config)).state === 'skipped');

  // Close: the page comes back.
  await page.touchscreen.tap(412 - 8 - 18, 8 + 18);
  await sleep(300);
  check('close restores the header', (await display('.site-header')) !== 'none');
  check('close restores the comments', (await display('.comments')) !== 'none');
  check('auto after close is skipped', (await run('auto', config)).state === 'skipped');
  await page.screenshot({ path: path.join(OUT, '5-closed.png') });

  // Previous chapter from chapter 3 with "read".
  check('read opens again', (await run('read', config)).state === 'reading');
  await showButtons();
  await page.touchscreen.tap(8 + 18, 8 + 18);
  await page.waitForURL(/ch-2\.html$/, { timeout: 5000 }).catch(() => {});
  check('previous arrow opens chapter 2', page.url().endsWith('/ch-2.html'), page.url());

  // --- Chapter 4 is the last one: its next button is disabled --------------
  await page.goto(BASE + '/ch-4.html');
  await page.waitForLoadState('load');
  await newWorld();
  check('auto opens on chapter 4', (await run('auto', config)).state === 'reading');

  // --- Chapter 5: the site has not loaded its images yet ----------------------
  await page.goto(BASE + '/ch-5.html');
  await page.waitForLoadState('load');
  await sleep(300);
  await newWorld();
  check('auto opens on chapter 5', (await run('auto', config)).state === 'reading');
  await sleep(1200);
  const loaded5 = () => page.$$eval('.reading-content img', els => els.filter(e => e.complete && e.naturalWidth > 100).length);
  const progress5 = [await loaded5()];
  for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, 600); await sleep(200); progress5.push(await loaded5()); }
  check('chapter 5 images load from top to bottom while scrolling',
        progress5[0] >= 1 && progress5[0] <= 4 && progress5[progress5.length - 1] === 12 &&
        progress5.every((n, i) => i === 0 || n >= progress5[i - 1]), progress5);
  const order = await page.$$eval('.reading-content img', els => els.map(e => e.complete && e.naturalWidth > 100 ? 1 : 0).join(''));
  check('no gaps: all 12 loaded', order === '111111111111', order);
  await page.evaluate(() => window.scrollTo(0, 0));
  await showButtons();
  await page.touchscreen.tap(8 + 36 + 6 + 18, 8 + 18);
  await sleep(500);
  check('no next chapter on the last one keeps the page', page.url().endsWith('/ch-5.html'));
  await page.screenshot({ path: path.join(OUT, '6-no-next.png') });

  // --- A page without a chapter: auto does nothing --------------------------
  await page.goto(BASE + '/home.html');
  await newWorld();
  check('auto waits on a page without chapter', (await run('auto', config)).state === 'waiting');
  await sleep(1000);
  check('home page stays as it is', (await run('state')).state === 'waiting' &&
        (await display('h1')) !== 'none');

  check('no console errors or CSP refusals', consoleErrors.length === 0, consoleErrors);
  console.log('CONFIG ' + JSON.stringify(config));
  await browser.close();
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
