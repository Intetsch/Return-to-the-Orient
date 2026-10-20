// Renders the icon of every mod ornament whose IconFilename lies in data/graphics/icons/ornaments into out/,
// plus out/sheet.png for review. --install copies each PNG into the mod and builds its _0.._3.dds with annotex.
// Usage: node render_all.js [--only name,name] [--install]
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { makeIcon } = require('./icon.js');
const MOD = path.resolve(__dirname, '../../..');
const ASSETS = path.join(MOD, 'data/config/export/main/asset/assets_includes/buildings/ornaments');
const ICONS = 'data/graphics/icons/ornaments/';
const OUT = path.join(__dirname, 'out');

const SKIP = ['IAAM Test'];                       // test asset, borrows palm.png
const PICK = { lighthouse: 3, ruin_large: 1 };   // variation index shown on the icon (default 0)
const OPTS = { place: { pngDecals: true } };     // place_01 paving only exists as PNG

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const install = args.includes('--install');

const jobs = new Map();
for (const f of fs.readdirSync(ASSETS).filter(f => f.endsWith('.xml'))) {
  for (const a of fs.readFileSync(path.join(ASSETS, f), 'utf8').split('<Asset>').slice(1)) {
    const icon = (a.match(/<IconFilename>([^<]*)</) || [])[1] || '';
    const name = (a.match(/<Name>([^<]*)</) || [])[1];
    if (!icon.startsWith(ICONS) || SKIP.includes(name)) continue;
    const base = path.basename(icon, '.png');
    if (jobs.has(base) || (only && !only.includes(base))) continue;
    const cfgs = [...a.matchAll(/<Filename>([^<]*\.cfg)</g)].map(m => m[1]);
    jobs.set(base, cfgs[PICK[base] ?? 0]);
  }
}
fs.mkdirSync(OUT, { recursive: true });
for (const [base, cfg] of jobs) {
  const out = path.join(OUT, base + '.png');
  makeIcon(MOD, cfg, out, OPTS[base] || {});
  if (!install) continue;
  // annotex writes the .dds files into its working directory
  execFileSync('C:/tools/annotex.exe', ['-f=diff', '-l=4', base + '.png'], { cwd: OUT, stdio: 'ignore' });
  for (const suffix of ['', '_0', '_1', '_2', '_3']) {
    const ext = suffix ? '.dds' : '.png';
    fs.copyFileSync(path.join(OUT, base + suffix + ext), path.join(MOD, ICONS, base + suffix + ext));
  }
}
const pngs = [...jobs.keys()].map(b => path.join(OUT, b + '.png'));
if (pngs.length) execFileSync(process.execPath, [path.join(__dirname, 'sheet.js'), path.join(OUT, 'sheet.png'), '8', '1', ...pngs], { stdio: 'inherit' });
console.log(`${jobs.size} icons${install ? ' installed' : ''}`);
