// Tiles RGBA PNGs onto a grey sheet. node montage.js out.png cols cell file...
const { read, write } = require('./png.js');
const [out, colsS, cellS, ...files] = process.argv.slice(2);
const cols = +colsS, cell = +cellS, rows = Math.ceil(files.length / cols);
const W = cols * cell, H = rows * cell, img = { w: W, h: H, data: Buffer.alloc(W * H * 4) };
for (let i = 0; i < W * H; i++) { const x = i % W, y = Math.floor(i / W); const c = ((Math.floor(x / cell) + Math.floor(y / cell)) % 2) ? 70 : 82; img.data[i * 4] = c; img.data[i * 4 + 1] = c; img.data[i * 4 + 2] = c + 6; img.data[i * 4 + 3] = 255; }
files.forEach((f, n) => {
  const t = read(f), ox = (n % cols) * cell, oy = Math.floor(n / cols) * cell, s = t.w / cell;
  for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
    const sx = Math.min(t.w - 1, Math.floor(x * s)), sy = Math.min(t.h - 1, Math.floor(y * s)), si = (sy * t.w + sx) * 4, di = ((oy + y) * W + ox + x) * 4;
    const a = t.data[si + 3] / 255;
    for (let c = 0; c < 3; c++) img.data[di + c] = Math.round(t.data[si + c] * a + img.data[di + c] * (1 - a));
  }
});
write(out, img);
console.log('wrote', out, W + 'x' + H);
