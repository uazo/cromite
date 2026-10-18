// Checks that the accent color that Java sends in texts.accent (Settings >
// Appearance > Accent color, CromIKO-Accent-Color.patch) reaches the CSS of the
// video player and of manga mode, and that the mascot star stays periwinkle.
//
// Usage, with the servers of the two other tests:
//   python3 tools/cromiko/video-test/server.py 8775 8776 &
//   python3 tools/cromiko/manga-test/server.py 8765 &
//   node tools/cromiko/accent-test.js path/to/cromiko_video.js path/to/cromiko_manga.js
const fs = require('fs');
const { chromium } = require('playwright');
const [videoPath, mangaPath] = process.argv.slice(2);
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(detail))); if (!ok) failures++; };

async function styles(cdp) {
  const out = [];
  for (const id of cdp.sheets) {
    const { text } = await cdp.send('CSS.getStyleSheetText', { styleSheetId: id });
    out.push(text);
  }
  return out.join('\n');
}

async function runScript(page, source, args, more = []) {
  const cdp = await page.context().newCDPSession(page);
  // The constructed style sheets of the scripts.
  cdp.sheets = [];
  cdp.on('CSS.styleSheetAdded', e => cdp.sheets.push(e.header.styleSheetId));
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const tree = await cdp.send('Page.getFrameTree');
  const world = await cdp.send('Page.createIsolatedWorld', { frameId: tree.frameTree.frame.id, worldName: 'cromiko' });
  const r = await cdp.send('Runtime.evaluate', { expression: source.replace('__CROMIKO_ARGS__', args), contextId: world.executionContextId, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  for (const next of more) {
    await new Promise(done => setTimeout(done, 300));
    const n = await cdp.send('Runtime.evaluate', { expression: source.replace('__CROMIKO_ARGS__', next), contextId: world.executionContextId, returnByValue: true });
    if (n.exceptionDetails) throw new Error(JSON.stringify(n.exceptionDetails));
  }
  return cdp;
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true });

  for (const [accent, label] of [['#E0607E', 'rose'], [null, 'no accent'], ['red', 'bad accent']]) {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8775/watch.html');
    const texts = accent === null ? 'null' : JSON.stringify({ accent });
    await page.evaluate(() => new Promise(r => { const v = document.querySelector('video'); v.readyState >= 1 ? r() : v.onloadedmetadata = r; }));
    const cdp = await runScript(page, fs.readFileSync(videoPath, 'utf8'), '"scan", null, ' + texts, ['"open", null, ' + texts]);
    await new Promise(r => setTimeout(r, 300));
    const css = await styles(cdp);
    const want = accent === '#E0607E' ? '#E0607E' : '#5C7CFC';
    check(`video (${label}): played bar in ${want}`, css.includes(`.played { background: ${want};`), css.slice(0, 200));
    check(`video (${label}): mascot star stays periwinkle`, css.includes('.m-accent { fill: #5C7CFC; }'));
    if (accent === '#E0607E') check('video: thumb ring from the accent', css.includes('rgba(224, 96, 126, 0.45)'));
    await page.close();
  }

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8765/ch-2.html');
  const cdp = await runScript(page, fs.readFileSync(mangaPath, 'utf8'), '"pick", null, ' + JSON.stringify({ accent: '#34B98A', stepNext: 'Next' }));
  await new Promise(r => setTimeout(r, 300));
  const css = await styles(cdp);
  check('manga: picker in the accent', css.includes('color: #34B98A;'), css.slice(0, 300));
  check('manga: picker box from the accent', css.includes('rgba(52, 185, 138, 0.18)'));
  await browser.close();
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
