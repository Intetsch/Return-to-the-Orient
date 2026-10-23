// QA sheet: every portrait posed from its rdm round trips (what the game plays), one row per portrait:
// rest, neutral idle @2.5s, angry idle @5s, friendly talk @7.5s. node animsheet.js <mod> out.png [id ...]
const fs = require('fs'), path = require('path');
const HERE = __dirname, WORK = path.join(HERE, 'work');
const MOD = process.argv[2], OUTF = process.argv[3];
const TOOLS = path.join(MOD, '.misc_data/tools/portrait_body');
const PNG = require(path.join(TOOLS, 'png.js'));
const { renderIcon } = require(path.join(TOOLS, 'icon.js'));
const { posed } = require('./posed.js');
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json')));
const want = process.argv.slice(4);
const base = f => path.basename(f).replace(/\.gr2$/i, '').toLowerCase();
const tiles = [];
const tmp = path.join(WORK, 'sheet'); fs.mkdirSync(tmp, { recursive: true });
for (const p of manifest.filter(p => !want.length || want.includes(p.id))) {
  const tex = PNG.decode(path.join(WORK, p.id, 'tex', p.id + '_diff.png'));
  const shots = [['neutral_idle', 0, true], ['neutral_idle', 150], ['angry_idle', 300], ['friendly_talk', 450]];
  shots.forEach(([slot, k, rest], n) => {
    const gl = path.join(WORK, p.id, 'check', base(p.slots[slot]), 'rt.gltf');
    const m = posed(gl, rest ? -1 : k);
    m.tex = tex; m.alphaTest = 128;
    const f = path.join(tmp, `${p.id}_${n}.png`);
    renderIcon([m], { yaw: -14, pitch: 0, center: [0, 10, -60], scale: 256 / 200 }, f);
    tiles.push(f);
  });
}
const { execFileSync } = require('child_process');
execFileSync('node', [path.join(HERE, 'montage.js'), OUTF, '8', '160', ...tiles], { stdio: 'inherit' });
