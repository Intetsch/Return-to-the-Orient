// Rewrites a .na2 so every bone's matrix is rigid and relative to the rest pose the Blender importer builds:
//   W'(t) = RestRigid · IWT · W(t)        (Granny row-vector matrices, translation in the last row)
// io_import_cn6 builds the armature from the .cn6 local position + quaternion only (RestRigid), and
// io_import_na2 keys only location + rotation. Bones whose Granny bind carries scale or a mirror
// (IWT not the inverse of RestRigid) therefore came out wrong: mirrored accessory bones by 20-150 units,
// Sir Gavin's 1.29-scaled face bones by 5-10. IWT·W(t) is Granny's own skin transform (rigid while the
// scale-shear stays constant), so with W' the converted skin equals Granny's: inv(RestRigid)·W' = IWT·W.
// Bones where RestRigid·IWT is already the identity are written unchanged.
//
// node na2rigid.js mesh.cn6 in.na2 out.na2      |  module: rigidify(cn6, inNa2, outNa2) -> changed bone names
const fs = require('fs');
const { parseCn6 } = require('./animcheck.js');

const mm = (A, B) => { const C = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) C[r * 4 + c] += A[r * 4 + k] * B[k * 4 + c]; return C; };
function rowRot(q) { // io_import_cn6: Quaternion((w,x,y,z)).to_matrix().transposed()
  const [x, y, z, w0] = q; const n = Math.hypot(x, y, z, w0); const [X, Y, Z, W] = [x / n, y / n, z / n, w0 / n];
  const c = [1 - 2 * (Y * Y + Z * Z), 2 * (X * Y - Z * W), 2 * (X * Z + Y * W), 2 * (X * Y + Z * W), 1 - 2 * (X * X + Z * Z), 2 * (Y * Z - X * W), 2 * (X * Z - Y * W), 2 * (Y * Z + X * W), 1 - 2 * (X * X + Y * Y)];
  return [c[0], c[3], c[6], c[1], c[4], c[7], c[2], c[5], c[8]];
}
function restRigid(cn) {
  const W = [];
  cn.bones.forEach((b, i) => {
    const r = rowRot(b.q);
    const L = [r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, b.pos[0], b.pos[1], b.pos[2], 1];
    W[i] = b.parent >= 0 ? mm(L, W[b.parent]) : L;
  });
  return W;
}
const isIdentity = (M, eps) => M.every((x, i) => Math.abs(x - ([0, 5, 10, 15].includes(i) ? 1 : 0)) < eps);

function rigidify(cn6File, inFile, outFile) {
  const cn = parseCn6(cn6File), rest = restRigid(cn);
  const corr = {}; // name -> RestRigid·IWT
  cn.bones.forEach((b, i) => { const C = mm(rest[i], b.iwt); if (!isIdentity(C, 1e-3)) corr[b.name] = C; });
  const L = fs.readFileSync(inFile, 'latin1').split('\n');
  let cur = null; const changed = new Set();
  const out = L.map(line => {
    const t = line.trim();
    const v = t.split(/\s+/);
    if (v.length === 16 && /^-?\d/.test(v[0])) {
      if (!cur || !corr[cur]) return line;
      changed.add(cur);
      return mm(corr[cur], v.map(Number)).map(x => x.toFixed(6)).join(' ') + ' ';
    }
    if (t && !/[:\/]/.test(t)) cur = t; // bone name line
    return line;
  });
  fs.writeFileSync(outFile, out.join('\n'), 'latin1'); // the bytes as read: bone names are UTF-8 (the corsair's strähne_links)
  return [...changed];
}
module.exports = { rigidify, restRigid };
if (require.main === module) {
  const [c, i, o] = process.argv.slice(2);
  if (o) console.log('rewritten bones:', rigidify(c, i, o).join(' '));
  else { // report RestRigid·IWT per bone
    const cn = parseCn6(c), rest = restRigid(cn);
    cn.bones.forEach((b, k) => { const C = mm(rest[k], b.iwt); const dev = Math.max(...C.map((x, j) => Math.abs(x - ([0, 5, 10, 15].includes(j) ? 1 : 0)))); console.log(b.name.padEnd(22), 'max |RestRigid·IWT - I|', dev.toFixed(5)); });
  }
}
