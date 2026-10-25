// Compare built .rdm (via rdm4-bin -> glb) with the source .gltf meshes: vertex/index/primitive counts + bounds.
// usage: node meshcheck.js <srcDir> <rdmDir> <tmpDir> <name>...   (name = gltf basename, e.g. factory_b0)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const [srcDir, rdmDir, tmp, ...names] = process.argv.slice(2);

function readGlb(file) {
  const b = fs.readFileSync(file);
  const jsonLen = b.readUInt32LE(12);
  return JSON.parse(b.slice(20, 20 + jsonLen).toString('utf8'));
}
function stats(g, mesh) {
  let v = 0, i = 0, min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (const p of mesh.primitives) {
    const a = g.accessors[p.attributes.POSITION];
    v += a.count;
    if (p.indices !== undefined) i += g.accessors[p.indices].count;
    if (a.min) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], a.min[k]); max[k] = Math.max(max[k], a.max[k]); }
  }
  return { prims: mesh.primitives.length, v, i, min: min.map(x => +x.toFixed(2)), max: max.map(x => +x.toFixed(2)) };
}
for (const n of names) {
  const g = JSON.parse(fs.readFileSync(path.join(srcDir, n + '.gltf'), 'utf8'));
  for (let lod = 0; lod < 9; lod++) {
    const rdm = path.join(rdmDir, `${n}_lod${lod}.rdm`);
    if (!fs.existsSync(rdm)) break;
    const node = g.nodes.find(x => x.name && x.name.endsWith('_lod' + lod) && x.mesh !== undefined);
    const mesh = node ? g.meshes[node.mesh] : g.meshes.find(m => m.name && m.name.endsWith('_lod' + lod));
    const s = stats(g, mesh);
    fs.rmSync(path.join(tmp, 'out.glb'), { force: true });
    cp.execFileSync('C:/tools/rdm4-bin.exe', ['-i', rdm, '-o', tmp, '--force'], { stdio: 'pipe' });
    const o = readGlb(path.join(tmp, 'out.glb'));
    const r = stats(o, o.meshes[0]);
    const ok = s.prims === r.prims && s.i === r.i;
    console.log(`${n}_lod${lod}: src prims=${s.prims} v=${s.v} idx=${s.i} | rdm prims=${r.prims} v=${r.v} idx=${r.i} bounds ${JSON.stringify(r.min)}..${JSON.stringify(r.max)} ${ok ? 'OK' : 'MISMATCH'}`);
  }
}
