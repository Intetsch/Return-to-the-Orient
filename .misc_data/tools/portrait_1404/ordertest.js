// Picker order check: the portrait submods applied by the game's mod loader
// (xmltest) to a minimal assets.xml, in random load orders and with random submods left out; the resulting
// CreateGameScene 500769 list must keep the vanilla entries first and ours in picker.json order.
// node ordertest.js <mod folder> [trials]
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { entries } = require('./submods.js');
const MOD = process.argv[2], TRIALS = +(process.argv[3] || 40);
const ext = path.join(os.homedir(), '.vscode/extensions');
const XT = path.join(ext, fs.readdirSync(ext).filter(d => d.startsWith('jakobharder.anno-modding-tools-')).sort().pop(), 'external/xmltest.exe');
const T = path.join(__dirname, 'work', 'ordertest');
const A = 'data/config/export/main/asset/assets.xml';
fs.mkdirSync(T, { recursive: true });
fs.writeFileSync(path.join(T, 'base.xml'), `<AssetList><Groups><Group><Assets>
<Asset><Template>Portrait</Template><Values><Standard><GUID>114620</GUID></Standard></Values></Asset>
<Asset><Template>CreateGameScene</Template><Values><Standard><GUID>500769</GUID></Standard><CreateGameScene><Portraits><Item><Portrait /></Item><Item><Portrait>100</Portrait></Item><Item><Portrait>101</Portrait></Item></Portraits></CreateGameScene></Values></Asset>
</Assets></Group></Groups></AssetList>
`);
const all = entries();
const canon = all.map(e => String(e.guid));
const mods = all.map(e => ({ dir: path.join(MOD, e.folder), guids: [String(e.guid)] }));
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
let bad = 0;
for (let t = 0; t < TRIALS; t++) {
  let set = mods.slice();
  for (let i = set.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [set[i], set[j]] = [set[j], set[i]]; }
  if (t === 0) set = mods.slice();                       // as listed
  else if (t === 1) set = mods.slice().reverse();         // reversed
  else if (t % 3 === 0) set = set.filter(() => rnd() > 0.4); // some left out
  if (!set.length) continue;
  const last = set[set.length - 1];
  const args = ['-v', '-o', path.join(T, 'out.xml'), ...set.slice(0, -1).flatMap(m => ['-p', m.dir]), path.join(T, 'base.xml'), path.join(last.dir, A), '-m', last.dir];
  const r = spawnSync(XT, args, { encoding: 'utf8', cwd: T });
  const log = r.stdout + r.stderr;
  const warn = log.split('\n').filter(l => /\[(warning|error)\]/.test(l));
  const out = fs.readFileSync(path.join(T, 'out.xml'), 'utf8');
  const list = [...out.match(/<Portraits>[\s\S]*?<\/Portraits>/)[0].matchAll(/<Portrait>(\d*)<\/Portrait>|<Portrait \/>/g)].map(m => m[1] ?? '');
  const want = ['', '100', '101', ...canon.filter(g => set.some(m => m.guids.includes(g)))];
  const assets = (out.match(/<Template>Portrait<\/Template>/g) || []).length - 1;
  const ok = JSON.stringify(list) === JSON.stringify(want) && assets === set.length && !warn.length;
  if (!ok) { bad++; console.log('FAIL trial', t, 'order', set.map(m => m.guids[0].slice(-3)).join(','), '\n got ', list.join(','), '\n want', want.join(','), '\n assets', assets, warn.slice(0, 3)); }
  else console.log('ok trial', String(t).padStart(2), set.length, 'mods, order', set.map(m => m.guids[0].slice(-3)).join(','));
}
console.log(bad ? bad + ' FAILED' : 'all trials passed');
