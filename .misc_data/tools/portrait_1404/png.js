// minimal PNG reader/writer (8-bit RGB/RGBA/Gray/GrayA, non-interlaced)
const fs = require('fs'), zlib = require('zlib');
function read(file) {
  const b = fs.readFileSync(file);
  let p = 8, w, h, ct, bd, idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('latin1', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; if (d[12]) throw new Error('interlaced'); }
    else if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  if (bd !== 8) throw new Error('bitdepth ' + bd);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, up = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? up : c); }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, i = x * ch;
      if (ch === 1) { out[o] = out[o + 1] = out[o + 2] = cur[i]; out[o + 3] = 255; }
      else if (ch === 2) { out[o] = out[o + 1] = out[o + 2] = cur[i]; out[o + 3] = cur[i + 1]; }
      else { out[o] = cur[i]; out[o + 1] = cur[i + 1]; out[o + 2] = cur[i + 2]; out[o + 3] = ch === 4 ? cur[i + 3] : 255; }
    }
    [prev, cur] = [cur, prev];
  }
  return { w, h, data: out };
}
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc(buf) { let c = -1; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); }
function write(file, img) {
  const { w, h, data } = img, raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
module.exports = { read, write };
if (require.main === module) {
  const [a, b] = process.argv.slice(2).map(read);
  if (a.w !== b.w || a.h !== b.h) { console.log('size differs', a.w, a.h, b.w, b.h); process.exit(); }
  let diff = 0, max = [0, 0, 0, 0], sum = [0, 0, 0, 0];
  for (let i = 0; i < a.data.length; i++) { const d = Math.abs(a.data[i] - b.data[i]); if (d) diff++; max[i & 3] = Math.max(max[i & 3], d); sum[i & 3] += a.data[i] - b.data[i]; }
  const n = a.w * a.h;
  console.log('differing bytes', diff, 'of', a.data.length, 'max per ch', max, 'mean diff per ch', sum.map(s => (s / n).toFixed(2)));
}
