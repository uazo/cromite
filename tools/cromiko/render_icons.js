// Renders the jobs written by gen_icons.py to PNG files.
// Usage: node render_icons.js <jobs.json> <out_root>
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const [jobsFile, outRoot] = process.argv.slice(2);
  const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const job of jobs) {
    await page.setViewportSize({ width: job.size, height: job.size });
    const svg = job.svg.replace('<svg ', '<svg style="display:block;width:100vw;height:100vh" ');
    await page.setContent(
        '<html><body style="margin:0;background:transparent">' + svg + '</body></html>');
    const out = path.join(outRoot, job.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, omitBackground: true });
  }
  await browser.close();
})();
