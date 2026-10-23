// Cut the beacon lanterns out of the user's 6x6 sheet (beacon_sheet.png: housing metal across, lens colour
// down, checkerboard background baked in) into 128x128 RGBA item icons, plus preview sheets on dark and
// magenta in <previewDir>. Then build the dds chain in the icon folder: annotex -f=diff -l=4 <name>.png
//   node cut_icons.js [previewDir]
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('../ornament_icons/png.js');

const OUT = path.resolve(__dirname, '../../../data/graphics/icons/items/lighthouse_beacons');
const PREVIEW = process.argv[2] || require('os').tmpdir();
fs.mkdirSync(OUT, { recursive: true });
const src = decode(path.join(__dirname, 'beacon_sheet.png'));
const { w: W, ch: C, px: P } = src;

const COLS = [[141, 242], [290, 388], [431, 531], [577, 674], [721, 821], [865, 962]];
const ROWS = [[55, 209], [216, 366], [372, 524], [530, 681], [687, 836], [841, 989]];
const HOUSING = { uncommon: 5, rare: 2, epic: 4, legendary: 0 };            // clear, copper, blackened iron, brass
const LENS = { all: 0, sail: 1, military: 2, air: 3, salvager: 4, steam: 5 }; // clear, blue, red, green, purple, orange-yellow
const SIZE = 128, FIT = 120; // leaves room for the outline glow

const rgb = (x, y) => { const i = (y * W + x) * C; return [P[i], P[i + 1], P[i + 2]]; };
// checkerboard: light grey, unsaturated
const isBg = (x, y) => { const [r, g, b] = rgb(x, y); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mn >= 228 && mx - mn <= 10; };

function cutCell(ci, ri) {
  const M = 6;
  const x0 = COLS[ci][0] - M, x1 = COLS[ci][1] + M, y0 = ROWS[ri][0] - M, y1 = ROWS[ri][1] + M;
  const cw = x1 - x0 + 1, chh = y1 - y0 + 1;
  // flood fill the background from the crop border
  const bg = new Uint8Array(cw * chh);
  const stack = [];
  for (let x = 0; x < cw; x++) { stack.push([x, 0], [x, chh - 1]); }
  for (let y = 0; y < chh; y++) { stack.push([0, y], [cw - 1, y]); }
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= cw || y >= chh) continue;
    const k = y * cw + x;
    if (bg[k] || !isBg(x0 + x, y0 + y)) continue;
    bg[k] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const comps = (test) => {
    const id = new Int32Array(cw * chh).fill(-1), list = [];
    for (let s = 0; s < cw * chh; s++) {
      if (id[s] >= 0 || !test(s)) continue;
      const pix = [s]; id[s] = list.length;
      for (let i = 0; i < pix.length; i++) {
        const k = pix[i], x = k % cw, y = (k - x) / cw;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, n = ny * cw + nx;
          if (nx < 0 || ny < 0 || nx >= cw || ny >= chh || id[n] >= 0 || !test(n)) continue;
          id[n] = list.length; pix.push(n);
        }
      }
      list.push(pix);
    }
    return list;
  };
  // keep only the lantern itself: the largest foreground piece (drops header marks and neighbour bits)
  const fg = comps(k => !bg[k]).sort((a, b) => b.length - a.length);
  fg.slice(1).forEach(p => p.forEach(k => { bg[k] = 1; }));
  // enclosed holes (the slot in the top cap) that show the plain checkerboard
  const strict = k => { const [r, g, b] = rgb(x0 + k % cw, y0 + Math.floor(k / cw)); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mn >= 232 && mx - mn <= 6; };
  // (both checker tones must show up; white glass highlights are one even tone)
  const lum = k => { const [r, g, b] = rgb(x0 + k % cw, y0 + Math.floor(k / cw)); return (r + g + b) / 3; };
  const checker = p => {
    const lo = p.filter(k => lum(k) < 245).length, hi = p.length - lo;
    return p.length >= 6 && lo >= p.length * 0.2 && hi >= p.length * 0.2;
  };
  // the lantern only has see-through holes in the top-cap slot and between the legs; striped glass elsewhere
  // can pass the tone test, so holes count only in those two height bands
  let fy0 = chh, fy1 = 0;
  for (const k of fg[0]) { const y = Math.floor(k / cw); fy0 = Math.min(fy0, y); fy1 = Math.max(fy1, y); }
  const band = p => { const cy = p.reduce((s, k) => s + Math.floor(k / cw), 0) / p.length, f = (cy - fy0) / (fy1 - fy0); return f < 0.08 || (f > 0.62 && f < 0.88); };
  comps(k => !bg[k] && strict(k)).filter(p => checker(p) && band(p)).forEach(p => p.forEach(k => { bg[k] = 1; }));
  // alpha: 0 on background; the first ring of foreground pixels next to background gets a partial alpha
  // from how far its colour sits from the background (anti-aliased edge), and is un-blended from white
  const out = Buffer.alloc(cw * chh * 4);
  for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
    const k = y * cw + x, o = k * 4;
    if (bg[k]) continue;
    let [r, g, b] = rgb(x0 + x, y0 + y);
    let a = 1;
    const edge = (x > 0 && bg[k - 1]) || (x < cw - 1 && bg[k + 1]) || (y > 0 && bg[k - cw]) || (y < chh - 1 && bg[k + cw]);
    if (edge) {
      const lum = (r + g + b) / 3;
      a = Math.min(1, Math.max(0.25, (245 - lum) / 120));
      const un = c => Math.max(0, Math.min(255, Math.round((c - 245 * (1 - a)) / a)));
      r = un(r); g = un(g); b = un(b);
    }
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = Math.round(a * 255);
  }
  // tight bounds
  let bx0 = cw, by0 = chh, bx1 = 0, by1 = 0;
  for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) if (out[(y * cw + x) * 4 + 3]) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  return { buf: out, cw, bx0, by0, bw: bx1 - bx0 + 1, bh: by1 - by0 + 1 };
}

// area resample (premultiplied) into a SIZE x SIZE canvas, centred
function toIcon(cell) {
  const s = FIT / Math.max(cell.bw, cell.bh);
  const dw = cell.bw * s, dh = cell.bh * s;
  const ox = (SIZE - dw) / 2, oy = (SIZE - dh) / 2;
  const acc = new Float64Array(SIZE * SIZE * 4);
  const SS = 4; // supersample each source pixel
  for (let y = 0; y < cell.bh; y++) for (let x = 0; x < cell.bw; x++) {
    const o = ((cell.by0 + y) * cell.cw + cell.bx0 + x) * 4;
    const a = cell.buf[o + 3] / 255;
    if (!a) continue;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const tx = Math.floor(ox + (x + (sx + 0.5) / SS) * s), ty = Math.floor(oy + (y + (sy + 0.5) / SS) * s);
      if (tx < 0 || ty < 0 || tx >= SIZE || ty >= SIZE) continue;
      const t = (ty * SIZE + tx) * 4, wgt = a / (SS * SS);
      acc[t] += cell.buf[o] * wgt; acc[t + 1] += cell.buf[o + 1] * wgt; acc[t + 2] += cell.buf[o + 2] * wgt; acc[t + 3] += wgt;
    }
  }
  const area = 1 / (s * s); // source pixels per target pixel
  const px = Buffer.alloc(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const a = acc[i * 4 + 3];
    if (!a) continue;
    px[i * 4] = Math.round(acc[i * 4] / a); px[i * 4 + 1] = Math.round(acc[i * 4 + 1] / a); px[i * 4 + 2] = Math.round(acc[i * 4 + 2] / a);
    px[i * 4 + 3] = Math.min(255, Math.round(a * area * 255));
  }
  return px;
}

// vanilla item icons have a 1px near-black contour and a faint dark glow; the cut edge instead keeps a light
// fringe from the checkerboard. Erode that fringe by one pixel and paint the contour and glow around the rest.
const LINE = [22, 18, 18], LINE_R = 1.2, GLOW_R = 4, GLOW_A = 0.06;
function outline(px) {
  const N = SIZE * SIZE, opaque = new Uint8Array(N), core = new Uint8Array(N);
  for (let i = 0; i < N; i++) opaque[i] = px[i * 4 + 3] >= 250;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let ok = opaque[y * SIZE + x];
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) {
      const nx = x + dx, ny = y + dy;
      ok = nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && opaque[ny * SIZE + nx];
    }
    core[y * SIZE + x] = ok;
  }
  const out = Buffer.alloc(N * 4), R = Math.ceil(GLOW_R);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = y * SIZE + x, o = i * 4;
    if (core[i]) { px.copy(out, o, o, o + 3); out[o + 3] = 255; continue; }
    let d2 = Infinity;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && core[ny * SIZE + nx]) d2 = Math.min(d2, dx * dx + dy * dy);
    }
    const d = Math.sqrt(d2);
    const a = Math.max(Math.min(1, Math.max(0, LINE_R + 0.5 - d)), d < GLOW_R ? GLOW_A * (1 - d / GLOW_R) : 0);
    out.set(LINE, o); out[o + 3] = Math.round(a * 255);
  }
  return out;
}

const icons = [];
for (const [type, ri] of Object.entries(LENS)) for (const [rar, ci] of Object.entries(HOUSING)) {
  const px = outline(toIcon(cutCell(ci, ri)));
  const name = `lighthouse_beacon_${type}_${rar}`;
  encode(path.join(OUT, name + '.png'), SIZE, SIZE, 4, px);
  icons.push({ name, px });
}

// previews: 4 rarities across, 6 types down, on dark grey and on magenta
for (const [tag, bgc] of [['dark', [40, 44, 52]], ['magenta', [255, 0, 255]]]) {
  const cols = 4, rows = 6, sw = cols * SIZE, sh = rows * SIZE, sp = Buffer.alloc(sw * sh * 3);
  for (let i = 0; i < sw * sh; i++) sp.set(bgc, i * 3);
  icons.forEach((ic, n) => {
    const gx = (n % cols) * SIZE, gy = Math.floor(n / cols) * SIZE;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const s = (y * SIZE + x) * 4, a = ic.px[s + 3] / 255, d = ((gy + y) * sw + gx + x) * 3;
      for (let c = 0; c < 3; c++) sp[d + c] = Math.round(ic.px[s + c] * a + bgc[c] * (1 - a));
    }
  });
  encode(path.join(PREVIEW, `beacon_preview_${tag}.png`), sw, sh, 3, sp);
}
console.log(icons.length, 'icons ->', OUT);
