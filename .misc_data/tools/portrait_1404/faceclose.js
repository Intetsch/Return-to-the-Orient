// Face close-ups of one portrait over several frames of one animation. node faceclose.js <mod> <id> <slot> out.png k1 k2 ...
const fs = require('fs'), path = require('path');
const HERE = __dirname, WORK = path.join(HERE, 'work');
const [MOD, id, slot, OUTF, ...ks] = process.argv.slice(2);
const TOOLS = path.join(MOD, '.misc_data/tools/portrait_body');
const PNG = require(path.join(TOOLS, 'png.js'));
const { renderIcon } = require(path.join(TOOLS, 'icon.js'));
const { posed } = require('./posed.js');
const { eyes } = require('./eyes.js');
const p = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'))).find(q => q.id === id);
const base = f => path.basename(f).replace(/\.gr2$/i, '').toLowerCase();
const gl = path.join(WORK, id, 'check', base(p.slots[slot]), 'rt.gltf');
const tex = PNG.decode(path.join(WORK, id, 'tex', id + '_diff.png'));
const e = eyes(gl);
const tiles = [];
for (const k of ks.map(Number)) {
  const m = posed(gl, k); m.tex = tex; m.alphaTest = 128;
  const f = path.join(WORK, 'sheet', `${id}_face_${k}.png`);
  renderIcon([m], { yaw: -14, pitch: 0, center: [0, 10, e.mean[2] + 5], scale: 256 / 70 }, f);
  tiles.push(f);
}
require('child_process').execFileSync('node', [path.join(HERE, 'montage.js'), OUTF, String(tiles.length), '256', ...tiles], { stdio: 'inherit' });
