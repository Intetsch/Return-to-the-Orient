// Per bone of a .cn6: determinant and axis scales of the Granny bind matrix (IWT 3x3), and the parent.
// Mirrored bones (det < 0) cannot survive the Blender na2 import (location + rotation keys only).
const { parseCn6 } = require('./animcheck.js');
function bindInfo(cn6) {
  const cn = parseCn6(cn6);
  return cn.bones.map(b => {
    const m = b.iwt;
    const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[1] * (m[4] * m[10] - m[6] * m[8]) + m[2] * (m[4] * m[9] - m[5] * m[8]);
    const rows = [0, 1, 2].map(r => Math.hypot(m[r * 4], m[r * 4 + 1], m[r * 4 + 2]));
    return { name: b.name, parent: b.parent >= 0 ? cn.bones[b.parent].name : '', det, rows };
  });
}
module.exports = { bindInfo };
if (require.main === module) {
  for (const b of bindInfo(process.argv[2])) {
    const flag = b.det < 0 ? 'MIRRORED' : Math.abs(b.det - 1) > 0.02 || b.rows.some(x => Math.abs(x - 1) > 0.02) ? 'scaled' : '';
    if (flag || process.argv[3]) console.log(b.name.padEnd(22), ('<' + b.parent).padEnd(22), 'det', b.det.toFixed(3).padStart(7), 'rows', b.rows.map(x => x.toFixed(3)).join(' '), flag);
  }
}
