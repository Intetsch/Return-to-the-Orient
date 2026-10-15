// Preview of bust + generated body, head to hips at the tile yaw. node bodyprev.js out.png cell id...
const fs = require('fs'), path = require('path');
const MOD = process.env.ORIENT_MOD || path.resolve(__dirname, '../../..');
const T = path.join(MOD, '.misc_data/tools/portrait_body');
const PNG = require(path.join(T, 'png.js'));
const { loadGltf } = require(path.join(T, 'render.js'));
const { renderIcon } = require(path.join(T, 'icon.js'));
const WORK = path.join(__dirname, 'work');
const [OUTF, cell, ...ids] = process.argv.slice(2);
const files = [];
for (const id of ids) {
  const bust = loadGltf(path.join(WORK, id, 'icon', 'out.gltf')); bust.tex = PNG.decode(path.join(WORK, id, 'tex', id + '_diff.png')); bust.alphaTest = 128;
  const body = loadGltf(path.join(WORK, id, 'body', 'body.gltf')); body.tex = PNG.decode(path.join(WORK, id, 'body', 'body_diff.png'));
  const AT = JSON.parse(fs.readFileSync(path.join(WORK, id, 'body', 'attrs.json')));
  const ztop = Math.min(...bust.pos.map(p => p[2])) - 4, zbot = AT.meta.zhip + 4;
  const f = path.join(WORK, 'sheet', `bodyprev_${id}.png`);
  renderIcon([bust, body], { yaw: -14, pitch: 0, center: [AT.meta.frame.xc, AT.meta.frame.yc + 10, (ztop + zbot) / 2], scale: 256 / (zbot - ztop) }, f);
  files.push(f);
}
require('child_process').execFileSync('node', [path.join(__dirname, 'montage.js'), OUTF, String(Math.min(8, files.length)), cell, ...files], { stdio: 'inherit' });
