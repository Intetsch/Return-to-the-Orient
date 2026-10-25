// Minimal .rdm reader: header ptr @32 -> Meta table (92-byte entries); Meta +4 vertex format, +12 VB, +16 IB.
// Arrays are [u32 count][u32 size] + data, the pointers point at the data.
const fs = require('fs');
function half(h) {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, f = h & 1023;
  if (e === 0) return s * f * Math.pow(2, -24);
  if (e === 31) return f ? NaN : s * Infinity;
  return s * Math.pow(2, e - 15) * (1 + f / 1024);
}
function readStruct(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x014d4452) throw new Error('not rdm ' + file);
  const mt = b.readUInt32LE(32), mcount = b.readUInt32LE(mt - 8);
  const metas = [];
  for (let i = 0; i < mcount; i++) {
    const e = mt + i * 92, vb = b.readUInt32LE(e + 12), ib = b.readUInt32LE(e + 16);
    metas.push({ vb, ib, vcount: b.readUInt32LE(vb - 8), stride: b.readUInt32LE(vb - 4), icount: b.readUInt32LE(ib - 8), isize: b.readUInt32LE(ib - 4) });
  }
  return { b, metas };
}
module.exports = { readStruct, half };
