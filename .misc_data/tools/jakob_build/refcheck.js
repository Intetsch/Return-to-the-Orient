// usage: node refcheck.js <modRoot> <submodDir>...  -> lists referenced files that exist nowhere
const fs = require('fs'), path = require('path');
const root = process.argv[2], subs = process.argv.slice(3);
const vanilla = 'D:/anno_data/1800';
const roots = [root, ...fs.readdirSync(root).map(d => path.join(root, d)).filter(d => fs.existsSync(path.join(d, 'data'))), vanilla];
function walk(d, out) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; }
function exists(rel) {
  rel = rel.replace(/\\/g, '/');
  const cands = [rel];
  if (/\.(png|psd|tga)$/i.test(rel)) cands.push(rel.replace(/\.(png|psd|tga)$/i, '_0.dds'));
  return roots.some(r => cands.some(c => fs.existsSync(path.join(r, c))));
}
const missing = new Map();
for (const s of subs) for (const f of walk(path.join(root, s), [])) {
  if (!/\.(cfg|ifo|prp|cf7|fc|yaml)$/i.test(f)) continue;
  if (f.includes(path.sep + '.vanilla' + path.sep)) continue;
  const txt = fs.readFileSync(f, 'latin1');
  for (const m of txt.matchAll(/(data[\\\/][^<>"\s:]+?\.(?:rdm|cfg|prp|png|psd|tga|dds|rdp|anm|fc|ifo))/gi)) {
    if (!exists(m[1])) { const k = m[1].replace(/\\/g, '/'); if (!missing.has(k)) missing.set(k, path.relative(root, f)); }
  }
}
for (const [k, v] of missing) console.log(k + '   <- ' + v);
console.log('missing:', missing.size);
