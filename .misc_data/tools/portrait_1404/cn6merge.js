// Merges all meshes of a .cn6 into one (vertices appended, triangle indices offset), keeping the first mesh's
// materials. rdm4-bin converts only the first mesh of a glTF, and the 1404 portraits draw every sub-mesh with
// the one diffuse texture of their cfg. Returns the number of meshes merged (1 = nothing to do).
// node cn6merge.js in.cn6 out.cn6
const fs = require('fs');
function merge(inFile, outFile) {
  const L = fs.readFileSync(inFile, 'latin1').split(/\r?\n/);
  const head = [], meshes = [];
  let i = 0;
  while (!L[i].startsWith('meshes:')) head.push(L[i++]);
  i++;
  let cur = null, sect = null;
  for (; i < L.length; i++) {
    const l = L[i];
    if (l.startsWith('mesh:')) { cur = { name: l, mats: [], verts: [], tris: [] }; meshes.push(cur); continue; }
    if (l === 'materials' || l === 'vertices' || l === 'triangles') { sect = l; continue; }
    if (l === 'end' || l === '') continue;
    if (sect === 'materials') cur.mats.push(l); else if (sect === 'vertices') cur.verts.push(l); else cur.tris.push(l);
  }
  if (meshes.length < 2) { fs.writeFileSync(outFile, L.join('\r\n'), 'latin1'); return meshes.length; }
  const main = meshes.reduce((a, b) => b.verts.length > a.verts.length ? b : a);
  const out = [...head, 'meshes:1', main.name, 'materials', ...meshes[0].mats, 'vertices'];
  const tris = []; let off = 0;
  for (const m of meshes) {
    out.push(...m.verts);
    for (const t of m.tris) { const v = t.trim().split(/\s+/).map(Number); tris.push(`${v[0] + off} ${v[1] + off} ${v[2] + off} 0`); }
    off += m.verts.length;
  }
  out.push('triangles', ...tris, 'end', '');
  fs.writeFileSync(outFile, out.join('\r\n'), 'latin1'); // the bytes as read (UTF-8 bone names)
  return meshes.length;
}
module.exports = { merge };
if (require.main === module) console.log(merge(process.argv[2], process.argv[3]));
