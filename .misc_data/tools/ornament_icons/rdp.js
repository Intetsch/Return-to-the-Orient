// Reads one frame of a baked .rdp particle system: the engine's short XML (<Tag>value</>, lists as
// CDATA[ + int32 length + bytes + ]) with per-particle ticks stored particle by particle.
// Returns the live particles as { p: [x,y,z], r: quad half-size, c: [r,g,b], a: 0..1 } in particle space.
const fs = require('fs');

function parseShortXml(b) {
  let i = 0;
  function list() {
    const out = {};
    while (i < b.length) {
      while (i < b.length && b[i] !== 0x3c) i++;
      if (i >= b.length) break;
      if (b[i + 1] === 0x2f) { i = b.indexOf(0x3e, i) + 1; return out; } // </>
      const e = b.indexOf(0x3e, i), tag = b.toString('latin1', i + 1, e);
      i = e + 1;
      if (b.toString('latin1', i, i + 6) === 'CDATA[') {
        const n = b.readInt32LE(i + 6);
        out[tag] = b.subarray(i + 10, i + 10 + n);
        i = b.indexOf(0x3e, i + 10 + n + 1) + 1;
        continue;
      }
      let j = i;
      while (j < b.length && b[j] !== 0x3c) j++;
      if (b[j + 1] === 0x2f) { out[tag] = b.toString('latin1', i, j).trim(); i = b.indexOf(0x3e, j) + 1; continue; }
      i = j;
      out[tag] = list();
    }
    return out;
  }
  return list();
}

// frame defaults to the middle of the loop
function snapshot(file, frame) {
  const d = parseShortXml(fs.readFileSync(file));
  const F = +d.FrameCount, N = +d.ParticleCount, MS = +d.MaxScale;
  const C = ['x', 'y', 'z'].map(k => +d.Center[k]), E = ['x', 'y', 'z'].map(k => +d.Extents[k]);
  const f = frame ?? Math.floor(F / 2), out = [];
  let o = 0;
  for (let p = 0; p < N; p++) {
    const s = d.P_Starts.readUInt16LE(p * 2), e = d.P_Ends.readUInt16LE(p * 2);
    const n = (e - s + F) % F + 1, k = (f - s + F) % F; // ticks are inclusive of start and end
    if (k < n) {
      const t = o + k;
      const pos = [0, 1, 2].map(a => d.T_Positions.readInt16LE(t * 6 + a * 2) / 32767 * E[a] + C[a]);
      const sc = (d.T_Scales[t * 3] + d.T_Scales[t * 3 + 2]) / 2 / 255 * MS; // view-aligned quad: x and z
      const c = d.T_Colors.subarray(t * 4, t * 4 + 4);                      // BGRA
      if (c[3]) out.push({ p: pos, r: sc / 2, c: [c[2], c[1], c[0]], a: c[3] / 255 });
    }
    o += n;
  }
  return out;
}
module.exports = { snapshot, parseShortXml };
