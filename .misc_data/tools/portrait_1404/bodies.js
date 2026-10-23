// Builds the lower-body meshes of the 1404 portraits (body1404.js) into work/<id>/body/{body.gltf,body.bin,attrs.json}
// and reports the rim it found and how far those rim vertices move in the portrait's animations (the body is static).
// Hip level: eye height + 238 units, where the Nomad (239.8) and Envoy (235.9) bodies end.
// node bodies.js [id ...]
const fs = require('fs'), path = require('path');
const HERE = __dirname, WORK = path.join(HERE, 'work');
const { build, W, H } = require('./body1404.js');
const { eyes } = require('./eyes.js');
const { posed } = require('./posed.js');
const { loadGltf } = require(path.join(process.env.ORIENT_MOD || path.resolve(__dirname, '../../..'), '.misc_data/tools/portrait_body/render.js'));
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json')));
const base = f => path.basename(f).replace(/\.gr2$/i, '').toLowerCase();
const HIP = 238;
const OPTS = {}; // per-portrait overrides of { rise, backLimit, hip }

function writeGltf(dir, m) {
  fs.mkdirSync(dir, { recursive: true });
  const nv = m.P.length;
  const f32 = arr => { const b = Buffer.alloc(arr.length * arr[0].length * 4); let o = 0; for (const e of arr) for (const v of e) { b.writeFloatLE(v, o); o += 4; } return b; };
  const parts = [f32(m.P), f32(m.N), f32(m.TAN), f32(m.UV)];
  const ib = Buffer.alloc(m.idx.length * 2); m.idx.forEach((v, i) => ib.writeUInt16LE(v, i * 2)); parts.push(ib);
  let off = 0; const views = [];
  for (const p of parts) { views.push({ buffer: 0, byteOffset: off, byteLength: p.length }); off += p.length; while (off % 4) off++; }
  const bin = Buffer.alloc(off); parts.forEach((p, i) => p.copy(bin, views[i].byteOffset));
  fs.writeFileSync(path.join(dir, 'body.bin'), bin);
  const mn = [0, 1, 2].map(k => Math.min(...m.P.map(p => p[k]))), mx = [0, 1, 2].map(k => Math.max(...m.P.map(p => p[k])));
  fs.writeFileSync(path.join(dir, 'body.gltf'), JSON.stringify({
    asset: { version: '2.0', generator: 'portrait_1404 body generator' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'body', mesh: 0 }],
    meshes: [{ name: 'body', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TANGENT: 2, TEXCOORD_0: 3 }, indices: 4, material: 0 }] }],
    materials: [{ name: 'body', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } }],
    buffers: [{ uri: 'body.bin', byteLength: bin.length }],
    bufferViews: views.map((v, i) => ({ ...v, target: i < 4 ? 34962 : 34963 })),
    accessors: [
      { bufferView: 0, componentType: 5126, count: nv, type: 'VEC3', min: mn, max: mx },
      { bufferView: 1, componentType: 5126, count: nv, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: nv, type: 'VEC4' },
      { bufferView: 3, componentType: 5126, count: nv, type: 'VEC2' },
      { bufferView: 4, componentType: 5123, count: m.idx.length, type: 'SCALAR' },
    ],
  }, null, 1));
  fs.writeFileSync(path.join(dir, 'attrs.json'), JSON.stringify({ meta: m.meta, attr: m.ATTR, cols: m.cols }));
}

const want = process.argv.slice(2), report = {};
for (const p of manifest.filter(q => !want.length || want.includes(q.id))) {
  const o = OPTS[p.id] || {};
  const e = eyes(path.join(WORK, p.id, 'check', base(p.slots.neutral_idle), 'rt.gltf'));
  const dev = ((e.restEyeYaw - 180) % 360 + 540) % 360 - 180;
  const bustGltf = path.join(WORK, p.id, 'icon', 'out.gltf'), bustPos = loadGltf(bustGltf).pos;
  // per-vertex motion over every animation; the rim is looked for on still triangles only
  const motion = new Float32Array(bustPos.length);
  for (const b of new Set(Object.values(p.slots).map(base))) {
    const gl = path.join(WORK, p.id, 'check', b, 'rt.gltf'), r0 = posed(gl, -1);
    if (r0.pos.length !== bustPos.length || r0.pos.some((q, i) => Math.hypot(q[0] - bustPos[i][0], q[1] - bustPos[i][1], q[2] - bustPos[i][2]) > 0.05)) throw new Error(p.id + ': ' + b + ' mesh differs from the shipped one');
    for (let k = 0; k < 600; k += 25) { const pk = posed(gl, k); pk.pos.forEach((q, i) => { motion[i] = Math.max(motion[i], Math.hypot(q[0] - r0.pos[i][0], q[1] - r0.pos[i][1], q[2] - r0.pos[i][2])); }); }
  }
  const still = [...motion].map(v => v < 0.5);
  const m = build(bustGltf, { zhip: e.rest[2] + (o.hip || HIP), eyeYawDev: Math.abs(dev) > 15 ? dev : 0, rise: o.rise, backLimit: o.backLimit, still });
  writeGltf(path.join(WORK, p.id, 'body'), m);
  const worst = Math.max(...m.chain.map(i => motion[i]));
  const th = m.cols.map(c => c.th * 180 / Math.PI);
  report[p.id] = { rim: m.chain.length, cols: m.meta.NC, from: +th[0].toFixed(0), to: +th[th.length - 1].toFixed(0), zhip: +m.meta.zhip.toFixed(1), rimMotion: +worst.toFixed(2), turned: +(m.meta.frame.phi * 180 / Math.PI).toFixed(1) };
  console.log(p.id.padEnd(30), JSON.stringify(report[p.id]));
}
fs.writeFileSync(path.join(WORK, 'bodies.json'), JSON.stringify(report, null, 1));
