// Removes the skin influence of bones that do not survive the Blender conversion (mirrored / sheared Granny
// bind matrices: Blender keys only location + rotation). Same repair as the hand-edited Nomad
// (s_nomad.cn6: Bone_cloth_Left/Right weights dropped, the rest renormalized to 255).
// A vertex left with no weight goes to the nearest unbroken ancestor of its strongest broken bone.
//
// node cn6fix.js in.cn6 out.cn6 bone [bone ...]
const fs = require('fs');
function fix(inFile, outFile, broken) {
  const L = fs.readFileSync(inFile, 'latin1').split(/\r?\n/);
  const bones = [];
  for (const l of L) { const m = l.trim().match(/^(\d+) "([^"]*)" (-?\d+) /); if (m) bones.push({ name: m[2], parent: +m[3] }); }
  const bad = new Set(broken.map(n => { const i = bones.findIndex(b => b.name === n); if (i < 0) throw new Error('no bone ' + n); return i; }));
  const ancestor = i => { while (i >= 0 && bad.has(i)) i = bones[i].parent; return i < 0 ? 0 : i; };
  let changed = 0, moved = 0;
  const out = L.map(l => {
    const v = l.trim().split(/\s+/);
    if (v.length < 34 || !/^-?\d/.test(v[0])) return l;
    const ids = v.slice(18, 26).map(Number), w = v.slice(26, 34).map(Number);
    if (!ids.some((id, q) => w[q] > 0 && bad.has(id))) return l;
    changed++;
    const keep = [];
    for (let q = 0; q < 8; q++) if (w[q] > 0 && !bad.has(ids[q])) keep.push([ids[q], w[q]]);
    if (!keep.length) {
      let strongest = 0; for (let q = 1; q < 8; q++) if (w[q] > w[strongest]) strongest = q;
      keep.push([ancestor(ids[strongest]), 255]); moved++;
    }
    // renormalize to 255 with largest remainders
    const sum = keep.reduce((a, k) => a + k[1], 0);
    const exact = keep.map(k => k[1] * 255 / sum), fl = exact.map(Math.floor);
    let rest = 255 - fl.reduce((a, b) => a + b, 0);
    exact.map((x, i) => [x - fl[i], i]).sort((a, b) => b[0] - a[0]).slice(0, rest).forEach(([, i]) => fl[i]++);
    const order = keep.map((k, i) => [k[0], fl[i]]).sort((a, b) => b[1] - a[1]);
    for (let q = 0; q < 8; q++) { v[18 + q] = String(q < order.length ? order[q][0] : 0); v[26 + q] = String(q < order.length ? order[q][1] : 0); }
    return v.join(' ') + ' ';
  });
  fs.writeFileSync(outFile, out.join('\r\n'), 'latin1');
  return { changed, moved };
}
module.exports = { fix };
if (require.main === module) { const [i, o, ...b] = process.argv.slice(2); console.log(fix(i, o, b)); }
