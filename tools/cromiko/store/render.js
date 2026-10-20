// Copyright 2026 The CromIKO Authors
// License: GPL-3.0-only - https://spdx.org/licenses/GPL-3.0-only.html
//
// Renders the store graphics for make_store_graphics.py.
//
//   node render.js graphics <build/store.html> <jobs.json>
//       Renders each job {id, width, height, out} of store.html#id.
//   node render.js player <build/player-site.html> <build/cromiko_video.js> <out.png>
//       Opens the CromIKO player of the real page script on the video of the
//       page, in landscape, and captures it with its controls.
const fs = require('fs');
const { chromium } = require('playwright');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function graphics(html, jobsFile) {
  const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
  const browser = await chromium.launch();
  for (const job of jobs) {
    const page = await browser.newPage({ viewport: { width: job.width, height: job.height } });
    await page.goto('file://' + html + '#' + job.id);
    await page.waitForFunction(() => document.body.dataset.ready === '1');
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
    await sleep(150);
    await page.screenshot({ path: job.out });
    console.log('  ' + job.out);
    await page.close();
  }
  await browser.close();
}

async function player(html, scriptFile, out) {
  const source = fs.readFileSync(scriptFile, 'utf8');
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({
    viewport: { width: 780, height: 360 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('file://' + html);
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
  // The page script runs in an isolated world, like ISOLATED_WORLD_ID_CHROME_INTERNAL.
  const cdp = await context.newCDPSession(page);
  const tree = await cdp.send('Page.getFrameTree');
  const world = await cdp.send('Page.createIsolatedWorld', { frameId: tree.frameTree.frame.id, worldName: 'cromiko' });
  const run = async (command) => {
    const r = await cdp.send('Runtime.evaluate', {
      expression: source.replace('__CROMIKO_ARGS__', JSON.stringify(command) + ', null, null'),
      contextId: world.executionContextId, returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return JSON.parse(r.result.value);
  };
  if (!(await run('open')).opened) throw new Error('The player did not open');
  await page.evaluate(() => new Promise((resolve) => {
    const v = document.querySelector('video');
    v.addEventListener('seeked', resolve, { once: true });
    v.currentTime = 754;
  }));
  await page.evaluate(() => document.querySelector('video').play());
  await sleep(800);
  if (!(await run('state')).controls) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 390, y: 180 }] });
    await sleep(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(500);
  }
  await page.screenshot({ path: out });
  console.log('  ' + out);
  await browser.close();
}

(async () => {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'graphics') await graphics(...args);
  else if (mode === 'player') await player(...args);
  else throw new Error('Unknown mode ' + mode);
})().catch((e) => { console.error(e); process.exit(1); });
