// Contact sheet of PNGs (RGB over a checkerboard where alpha < 255), cols per row, optional upscale.
// Usage: node sheet.js out.png cols scale in1.png in2.png ...
const fs = require('fs'), path = require('path');
const { decode, encode } = require(path.join(__dirname, 'png.js'));
const [out, colsArg, scaleArg, ...files] = process.argv.slice(2);
const cols = +colsArg, k = +scaleArg;
const imgs = files.map(f => decode(f));
const cw = Math.max(...imgs.map(i => i.w)) * k + 4, chh = Math.max(...imgs.map(i => i.h)) * k + 4;
const rows = Math.ceil(imgs.length / cols), W = cols * cw, H = rows * chh;
const px = Buffer.alloc(W * H * 3, 40);
imgs.forEach((im, n) => {
  const ox = (n % cols) * cw + 2, oy = Math.floor(n / cols) * chh + 2;
  for (let y = 0; y < im.h * k; y++) for (let x = 0; x < im.w * k; x++) {
    const s = (Math.floor(y / k) * im.w + Math.floor(x / k)) * im.ch;
    const a = im.ch === 4 ? im.px[s + 3] / 255 : 1;
    const bg = ((x >> 3) + (y >> 3)) & 1 ? 200 : 120;
    const d = ((oy + y) * W + ox + x) * 3;
    for (let c = 0; c < 3; c++) px[d + c] = Math.round(im.px[s + Math.min(c, im.ch - 1)] * a + bg * (1 - a));
  }
});
encode(out, W, H, 3, px);
console.log(`wrote ${out} ${W}x${H}`);
