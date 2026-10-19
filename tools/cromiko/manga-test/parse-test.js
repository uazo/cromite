// Tests how the manga mode page script (see test.js) finds the series and the
// chapter number of a chapter in its title or address, for "Continue reading".
//
// Usage (needs Node.js): node tools/cromiko/manga-test/parse-test.js [path/to/cromiko_manga.js]
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PATCHES = path.join(__dirname, '../../../build/patches');
const SCRIPT = 'chrome/android/java/res/raw/cromiko_manga.js';
const source = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : scriptFromPatches();

// The script as added by CromIKO-Manga-Mode.patch, with the changes of the later
// patches.
function scriptFromPatches() {
  const lines = fs.readFileSync(path.join(PATCHES, 'CromIKO-Manga-Mode.patch'), 'utf8').split('\n');
  const start = lines.indexOf('+++ b/' + SCRIPT);
  const out = [];
  for (let i = start + 2; i < lines.length && !lines[i].startsWith('diff --git'); i++) {
    if (lines[i].startsWith('+')) out.push(lines[i].slice(1));
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cromiko-manga-'));
  fs.mkdirSync(path.join(dir, path.dirname(SCRIPT)), { recursive: true });
  fs.writeFileSync(path.join(dir, SCRIPT), out.join('\n') + '\n');
  for (const later of ['CromIKO-Manga-Continue-Reading.patch', 'CromIKO-Manga-Image-Finder.patch']) {
    execFileSync('git', ['apply', '--include=' + SCRIPT, path.join(PATCHES, later)], { cwd: dir });
  }
  return fs.readFileSync(path.join(dir, SCRIPT), 'utf8');
}

// The parsing functions of the script, taken out of it.
function extract(...patterns) {
  return patterns.map(re => {
    const m = source.match(re);
    if (!m) throw new Error('Not in the script: ' + re);
    return m[0];
  }).join('\n');
}
const parseTitle = new Function(extract(
    /const CHAPTER_RE = new RegExp\([\s\S]*?'i'\);/, /const TITLE_SEPARATOR = .*;/,
    /function parseTitle\(text\) \{[\s\S]*?\n    \}\n/) + '\nreturn parseTitle;')();
const urlCode = extract(/function titleCase\(slug\) \{[\s\S]*?\n    \}\n/,
                        /function parseUrl\(\) \{[\s\S]*?\n    \}\n/) + '\nreturn parseUrl();';
const parseUrl = (pathname) => new Function('location', urlCode)({ pathname });

let failures = 0;
function check(input, result, series, chapter) {
  const ok = series === null ? result === null :
      !!result && result.series === series && result.chapter === chapter;
  console.log((ok ? 'PASS ' : 'FAIL ') + JSON.stringify(input) + ' -> ' + JSON.stringify(result));
  if (!ok) failures++;
}

for (const [title, series, chapter] of [
  ['Series - Chapter 2', 'Series', '2'],
  ['Read One Piece Chapter 1050 Online - MangaSite', 'One Piece', '1050'],
  ['Chapter 1050 - One Piece - MangaSite', 'One Piece', '1050'],
  ['MangaSite | One Piece Chapter 1050', 'One Piece', '1050'],
  ['One Piece, Chapter 1050.5', 'One Piece', '1050.5'],
  ['Solo Leveling Ch. 110 | Asura Scans', 'Solo Leveling', '110'],
  ['Tower of God - Episode 550 – Webtoon', 'Tower of God', '550'],
  ['Kagurabachi #45 - Site', 'Kagurabachi', '45'],
  ['Berserk Capítulo 375', 'Berserk', '375'],
  ['Chapter 7', '', '7'],
  ['Watch 2 cats', null, null],
]) {
  check(title, parseTitle(title), series, chapter);
}
for (const [pathname, series, chapter] of [
  ['/manga/one-piece/chapter-1050/', 'One Piece', '1050'],
  ['/read/one-piece-chapter-1050', 'One Piece', '1050'],
  ['/series/solo-leveling/c110', 'Solo Leveling', '110'],
  ['/manga/berserk/375', 'Berserk', '375'],
  ['/manga/kagurabachi/chapter-45-5/', 'Kagurabachi', '45.5'],
  ['/ch-2.html', '', '2'],
  ['/about', null, null],
]) {
  check(pathname, parseUrl(pathname), series, chapter);
}
console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
process.exit(failures ? 1 : 0);
