// 256px player-portrait picker tiles for the 1404 portraits, rendered from the bust alone with the Nomad/Envoy
// tile renderer (.misc_data/tools/portrait_body/icon.js: yaw -14°, 4x supersampling, transparent background),
// with its alpha test on, as the game's model shader cuts out the 1404 hair and feather cards.
// Framing: top of the head (hat included) at the top edge; height 162 mesh units like the Nomad tile (more for tall
// headwear), but never below where the bust still covers the middle of the tile, so the tile is filled to the bottom
// edge like the vanilla ones (at least 120 units). Writes work/icons/portrait_1404_<id>.png;
// INSTALL=1 also copies it into data/ui/2kimages/main/profiles and builds the _0.._3 DDS chain.
//
// node icons.js <mod folder> [id ...]
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const HERE = __dirname, WORK = path.join(HERE, 'work');
const MOD = process.argv[2];
const TOOLS = path.join(MOD, '.misc_data/tools/portrait_body');
const PNG = require(path.join(TOOLS, 'png.js'));
const { loadGltf } = require(path.join(TOOLS, 'render.js'));
const { renderIcon } = require(path.join(TOOLS, 'icon.js'));
const { eyes } = require('./eyes.js');
const { tilePose } = require('./tilepose.js');
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json')));
const want = process.argv.slice(3);
const OUT = path.join(WORK, 'icons');
fs.mkdirSync(OUT, { recursive: true });
const base = f => path.basename(f).replace(/\.gr2$/i, '').toLowerCase();
const info = {};
// Busts modelled turned (Lord Northburg −34°, Sick Emperor +28°, shoulders as well) get the camera turned so they
// look where the other tiles look, and shifted so the eyes sit at the horizontal spot they have on the other tiles
// (median over those). 'auto' turns by the eye line's deviation from square. The Lord's tile yaw is set by eye:
// with his head tilt and lopsided smile he still read as looking right at the measured 20.5°; at 40° he matches.
const FACE_ALIGN = new Map([['lord_richard_northburg', 40], ['sick_emperor', 'auto']]);
const YAW = -14, D2R = Math.PI / 180;
const eyesOf = p => eyes(path.join(WORK, p.id, 'check', base(p.slots.neutral_idle), 'rt.gltf'));
const screenX = (e, yawDeg, x0) => -(Math.cos(yawDeg * D2R) * (e.rest[0] - x0) - Math.sin(yawDeg * D2R) * (e.rest[1] - 10));
let eyeX = null;
const eyeTarget = () => eyeX ?? (eyeX = (() => { const v = manifest.filter(q => !FACE_ALIGN.has(q.id)).map(q => screenX(eyesOf(q), YAW, 0)).sort((a, b) => a - b); return v[v.length >> 1]; })());
for (const p of manifest.filter(p => !want.length || want.includes(p.id))) {
  const id = p.id, dir = path.join(WORK, id, 'icon');
  fs.mkdirSync(dir, { recursive: true });
  const rdm = path.join(MOD, 'data/graphics/portraits/1404', id, 'rdm', id + '.rdm');
  const r = spawnSync('C:/tools/rdm4-bin.exe', ['-i', rdm, '-o', path.join(dir, 'out'), '-s', '-e', 'gltf', '--force'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  // aligned busts: rest pose, but the eyes at their mean neutral-idle rotation (Lord Northburg's bind pose has the
  // eyeballs turned aside, so his tile still looked away after the head was turned to the camera)
  const bust = FACE_ALIGN.has(id)
    ? tilePose(path.join(WORK, id, 'check', base(p.slots.neutral_idle), 'rt.gltf'), ['Bone_L_Eye', 'Bone_R_Eye', 'SkinBone_Eye_Lf', 'SkinBone_Eye_Rt'])
    : loadGltf(path.join(dir, 'out.gltf'));
  bust.tex = PNG.decode(path.join(WORK, id, 'tex', id + '_diff.png'));
  bust.alphaTest = 128;
  const e = eyesOf(p);
  let yawDeg = YAW, x0 = 0;
  if (FACE_ALIGN.has(id)) {
    const dev = ((e.restEyeYaw - 180) % 360 + 540) % 360 - 180;
    yawDeg = FACE_ALIGN.get(id) === 'auto' ? YAW - dev : FACE_ALIGN.get(id);
    x0 = e.rest[0] - (-eyeTarget() + Math.sin(yawDeg * D2R) * (e.rest[1] - 10)) / Math.cos(yawDeg * D2R);
  }
  const zmin = Math.min(...bust.pos.map(v => v[2]));
  const ztop = zmin - 3;
  // bottom: vanilla tiles are filled to the bottom edge, so stop where the bust still covers the middle of the tile
  // (|x| <= 25 in the tile's view); the 1404 busts end mid-chest with a ragged open edge
  const yaw = yawDeg * D2R, colBottom = new Array(51).fill(-Infinity); // columns x = -25..25
  const sx = v => Math.cos(yaw) * (v[0] - x0) - Math.sin(yaw) * (v[1] - 10);
  for (let t = 0; t < bust.idx.length; t += 3) {
    const P = [0, 1, 2].map(k => { const v = bust.pos[bust.idx[t + k]]; return [sx(v), v[2]]; });
    for (let c = 0; c <= 50; c++) {
      const x = c - 25, zs = [];
      for (let k = 0; k < 3; k++) { const [a, b] = [P[k], P[(k + 1) % 3]]; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) zs.push(a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])); }
      if (zs.length) colBottom[c] = Math.max(colBottom[c], ...zs);
    }
  }
  const cover = Math.min(...colBottom);
  // with the generated lower body (work/<id>/body) the tile is framed like the Nomad's and Envoy's: 162 units from the
  // top of the head, the body filling the bottom; without it, stop where the bust still covers the middle of the tile
  const bodyDir = path.join(WORK, id, 'body'), hasBody = fs.existsSync(path.join(bodyDir, 'body.gltf'));
  const H = hasBody ? Math.max(162, e.rest[2] - ztop + 108) : Math.max(120, Math.min(Math.max(162, e.rest[2] - ztop + 108), cover - 2 - ztop));
  const zbot = ztop + H;
  const zlow = cover;
  const meshes = [bust];
  if (hasBody) { const body = loadGltf(path.join(bodyDir, 'body.gltf')); body.tex = PNG.decode(path.join(bodyDir, 'body_diff.png')); meshes.push(body); }
  renderIcon(meshes, { yaw: yawDeg, pitch: 0, center: [x0, 10, (ztop + zbot) / 2], scale: 256 / H }, path.join(OUT, `portrait_1404_${id}.png`));
  info[id] = { ztop: +ztop.toFixed(1), zbot: +zbot.toFixed(1), bustBottom: +zlow.toFixed(1), eyeZ: +e.rest[2].toFixed(1), yaw: +yawDeg.toFixed(1), x0: +x0.toFixed(1) };
  console.log(id.padEnd(30), JSON.stringify(info[id]));
  if (process.env.INSTALL === '1') {
    // like portrait_body/build.sh: the PNG next to its LOD chain _0.._3 (256px.._32px)
    const prof = path.join(MOD, 'data/ui/2kimages/main/profiles');
    fs.copyFileSync(path.join(OUT, `portrait_1404_${id}.png`), path.join(prof, `portrait_1404_${id}.png`));
    const a = spawnSync('C:/tools/annotex.exe', ['-f=diff', '-l=4', `portrait_1404_${id}.png`], { cwd: prof, encoding: 'utf8' });
    if (a.status !== 0) throw new Error(a.stdout + a.stderr);
  }
}
fs.writeFileSync(path.join(OUT, 'framing.json'), JSON.stringify(info, null, 1));
