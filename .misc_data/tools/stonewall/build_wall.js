// Small / Large Oriental Wall meshes: 1x1 wall pieces for the neighbour system (arms at rotation 0, as vanilla 102093):
//   mid -x/+x, end -x (free end toward +x), corner +x/-z, x all four, t -x/+x/-z, single (no neighbour, both ends free).
// Wall: height H, thickness 2*TH, free ends chamfered like the Incense Workshop wall (top set back by CH).
// Side faces: u runs along n x up (the source wall's convention) and is 0 or 1 at every tile edge, so any mix of
// rotated tiles continues the periodic face band; corners use the path length so the band wraps around them.
// kit(H, layout) builds faces for one height; build_junction.js mixes two kits.
// node build_wall.js <texDir with the layout json> <outDir> [small|large]  -> <outDir>/<piece>/<prefix>_<piece>_lod0.gltf (+ .bin)
const fs = require('fs'), path = require('path');
const VARIANTS = require('./variants.js');
const { TH, E, CH } = VARIANTS, U_END = [0.3, 0.6], U_CAP = 0.45;

const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };

// one flat polygon: corners [x,y,z], uv function, outward hint
function poly(pts, uvOf, hint) {
  return { pts, uv: pts.map(uvOf), hint };
}
const uFront = p => -p[0] + 0.5, uBack = p => p[0] + 0.5; // faces at z=+TH / z=-TH
const uRight = p => p[2] + 0.5, uLeft = p => -p[2] + 0.5;  // faces at x=+TH / x=-TH
const T = TH, h = 0.5;

function kit(H, L) {
  const vFace = y => L.face.v0 + (L.face.v1 - L.face.v0) * y / H;
  const vCap = f => L.cap.v0 + (L.cap.v1 - L.cap.v0) * f;
  // vertical side face between bottom points a -> b (x,z), tops optionally moved (chamfer); u from uOf(p)
  function side(a, b, hint, uOf, ta = a, tb = b) {
    return poly([[a[0], 0, a[1]], [b[0], 0, b[1]], [tb[0], H, tb[1]], [ta[0], H, ta[1]]], p => [uOf(p), vFace(p[1])], hint);
  }
  // top polygon (x,z corners at height H) with arm direction 'x+', 'x-', 'z+', 'z-' (u along it, v across = a x up)
  function top(corners, dir) {
    const map = {
      'x+': p => [p[0] + 0.5, vCap((p[2] + TH) / (2 * TH))],
      'z-': p => [-p[2] + 0.5, vCap((p[0] + TH) / (2 * TH))],
      'z+': p => [p[2] + 0.5, vCap((TH - p[0]) / (2 * TH))],
    }[dir];
    return poly(corners.map(c => [c[0], H, c[1]]), map, [0, 1, 0]);
  }
  // chamfered free end at x = sx*E (sx = +1 or -1)
  function endFace(sx) {
    const xb = sx * E, xt = sx * (E - CH), u0 = U_END[sx > 0 ? 0 : 1];
    return poly([[xb, 0, -TH], [xb, 0, TH], [xt, H, TH], [xt, H, -TH]], p => [u0 + (sx > 0 ? p[2] + TH : TH - p[2]), vFace(p[1])], [sx, 0, 0]);
  }
  // closed end where an arm meets the tile edge ('+x', '-x', '+z', '-z'): the game fits each tile to the terrain on its
  // own, so neighbours can sit at slightly different heights; without this cap the step shows the hollow wall inside.
  // Lined up, the caps of both tiles lie inside the wall and stay hidden.
  function cap(dir) {
    const s = dir[0] === '+' ? 1 : -1, n = dir[1] === 'x' ? [s, 0, 0] : [0, 0, s];
    const across = dir[1] === 'x' ? [[s * h, -TH], [s * h, TH]] : [[-TH, s * h], [TH, s * h]];
    const pts = [[across[0][0], 0, across[0][1]], [across[1][0], 0, across[1][1]], [across[1][0], H, across[1][1]], [across[0][0], H, across[0][1]]];
    const t = [n[1] * 0 - n[2] * 1, n[2] * 0 - n[0] * 0, n[0] * 1 - n[1] * 0]; // n x up: u runs along it like on the side faces
    return poly(pts, p => [U_CAP + TH + t[0] * p[0] + t[2] * p[2], vFace(p[1])], n);
  }

  const PIECES = {
    mid: [
      side([-h, T], [h, T], [0, 0, 1], uFront), side([-h, -T], [h, -T], [0, 0, -1], uBack),
      top([[-h, -T], [h, -T], [h, T], [-h, T]], 'x+'), cap('-x'), cap('+x'),
    ],
    end: [
      side([-h, T], [E, T], [0, 0, 1], uFront, [-h, T], [E - CH, T]), side([-h, -T], [E, -T], [0, 0, -1], uBack, [-h, -T], [E - CH, -T]),
      top([[-h, -T], [E - CH, -T], [E - CH, T], [-h, T]], 'x+'), endFace(1), cap('-x'),
    ],
    single: [
      side([-E, T], [E, T], [0, 0, 1], uFront, [-E + CH, T], [E - CH, T]), side([-E, -T], [E, -T], [0, 0, -1], uBack, [-E + CH, -T], [E - CH, -T]),
      top([[-E + CH, -T], [E - CH, -T], [E - CH, T], [-E + CH, T]], 'x+'), endFace(1), endFace(-1),
    ],
    corner: [
      // outer path (h,T) -> (-T,T) -> (-T,-h), length 1.1; inner path (T,-h) -> (T,-T) -> (h,-T), length 0.9
      side([-T, T], [h, T], [0, 0, 1], p => (h - p[0]) / 1.1), side([-T, -h], [-T, T], [-1, 0, 0], p => (h + T + (T - p[2])) / 1.1),
      side([T, -h], [T, -T], [1, 0, 0], p => (p[2] + h) / 0.9), side([T, -T], [h, -T], [0, 0, -1], p => (h - T + (p[0] - T)) / 0.9),
      top([[-T, T], [T, -T], [h, -T], [h, T]], 'x+'), top([[-T, T], [-T, -h], [T, -h], [T, -T]], 'z-'), cap('+x'), cap('-z'),
    ],
    t: [
      side([-h, T], [h, T], [0, 0, 1], uFront),
      side([-h, -T], [-T, -T], [0, 0, -1], uBack), side([T, -T], [h, -T], [0, 0, -1], uBack),
      side([-T, -h], [-T, -T], [-1, 0, 0], uLeft), side([T, -h], [T, -T], [1, 0, 0], uRight),
      top([[-h, -T], [h, -T], [h, T], [-h, T]], 'x+'), top([[-T, -T], [-T, -h], [T, -h], [T, -T]], 'z-'),
      cap('-x'), cap('+x'), cap('-z'),
    ],
    x: [
      side([-h, T], [-T, T], [0, 0, 1], uFront), side([T, T], [h, T], [0, 0, 1], uFront),
      side([-h, -T], [-T, -T], [0, 0, -1], uBack), side([T, -T], [h, -T], [0, 0, -1], uBack),
      side([-T, -h], [-T, -T], [-1, 0, 0], uLeft), side([-T, T], [-T, h], [-1, 0, 0], uLeft),
      side([T, -h], [T, -T], [1, 0, 0], uRight), side([T, T], [T, h], [1, 0, 0], uRight),
      top([[-h, -T], [h, -T], [h, T], [-h, T]], 'x+'), top([[-T, -T], [-T, -h], [T, -h], [T, -T]], 'z-'),
      top([[-T, T], [T, T], [T, h], [-T, h]], 'z+'), cap('-x'), cap('+x'), cap('-z'), cap('+z'),
    ],
  };
  return { H, side, top, endFace, cap, PIECES };
}
const layoutOf = (texDir, variant) => JSON.parse(fs.readFileSync(path.join(texDir, VARIANTS[variant].layout), 'utf8'));

// triangulate (fan), flat normal from geometry oriented by the hint, winding (b-a)x(c-a) along the normal
function mesh(polys) {
  const P = [], N = [], UV = [], TAN = [], idx = [];
  for (const f of polys) {
    let n = nrm(cross(sub(f.pts[1], f.pts[0]), sub(f.pts[2], f.pts[0])));
    if (dot(n, f.hint) < 0) n = n.map(v => -v);
    // tangent frame of the face (vanilla: T = -dP/du, B = -dP/dv; written here as glTF +dP/du with w for B)
    const [a, b, c] = [0, 1, 2], e1 = sub(f.pts[b], f.pts[a]), e2 = sub(f.pts[c], f.pts[a]);
    const du1 = f.uv[b][0] - f.uv[a][0], dv1 = f.uv[b][1] - f.uv[a][1], du2 = f.uv[c][0] - f.uv[a][0], dv2 = f.uv[c][1] - f.uv[a][1];
    const r = du1 * dv2 - du2 * dv1;
    const dPdu = e1.map((v, k) => (v * dv2 - e2[k] * dv1) / r), dPdv = e1.map((v, k) => (e2[k] * du1 - v * du2) / r);
    const t = nrm(sub(dPdu, n.map(v => v * dot(n, dPdu)))), w = dot(cross(n, t), dPdv) > 0 ? 1 : -1;
    const base = P.length;
    f.pts.forEach((p, i) => { P.push(p); N.push(n); UV.push(f.uv[i]); TAN.push([...t, w]); });
    for (let i = 1; i + 1 < f.pts.length; i++) {
      let tri = [base, base + i, base + i + 1];
      if (dot(cross(sub(P[tri[1]], P[tri[0]]), sub(P[tri[2]], P[tri[0]])), n) < 0) tri = [tri[0], tri[2], tri[1]];
      idx.push(...tri);
    }
  }
  return { P, N, UV, TAN, idx };
}

function writeGltf(file, m) {
  const nv = m.P.length, f32 = arr => { const b = Buffer.alloc(arr.length * arr[0].length * 4); let o = 0; for (const e of arr) for (const v of e) { b.writeFloatLE(v, o); o += 4; } return b; };
  const ib = Buffer.alloc(m.idx.length * 2); m.idx.forEach((v, i) => ib.writeUInt16LE(v, i * 2));
  const parts = [f32(m.P), f32(m.N), f32(m.TAN), f32(m.UV), ib]; let off = 0; const views = [];
  for (const p of parts) { views.push({ buffer: 0, byteOffset: off, byteLength: p.length }); off += p.length; while (off % 4) off++; }
  const bin = Buffer.alloc(off); parts.forEach((p, i) => p.copy(bin, views[i].byteOffset));
  const binName = path.basename(file).replace(/\.gltf$/, '.bin');
  fs.writeFileSync(path.join(path.dirname(file), binName), bin);
  const mn = [0, 1, 2].map(k => Math.min(...m.P.map(p => p[k]))), mx = [0, 1, 2].map(k => Math.max(...m.P.map(p => p[k])));
  const name = path.basename(file, '.gltf');
  fs.writeFileSync(file, JSON.stringify({
    asset: { version: '2.0', generator: 'stonewall generator' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TANGENT: 2, TEXCOORD_0: 3 }, indices: 4, material: 0 }] }],
    materials: [{ name: 'building_material', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } }],
    buffers: [{ uri: binName, byteLength: bin.length }],
    bufferViews: views.map((v, i) => ({ ...v, target: i < 4 ? 34962 : 34963 })),
    accessors: [
      { bufferView: 0, componentType: 5126, count: nv, type: 'VEC3', min: mn, max: mx },
      { bufferView: 1, componentType: 5126, count: nv, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: nv, type: 'VEC4' },
      { bufferView: 3, componentType: 5126, count: nv, type: 'VEC2' },
      { bufferView: 4, componentType: 5123, count: m.idx.length, type: 'SCALAR' },
    ],
  }, null, 1));
  return { nv, tris: m.idx.length / 3, mn, mx };
}

module.exports = { kit, layoutOf, mesh, writeGltf, uFront, uBack, uRight, uLeft, T, h };
if (require.main === module) {
  const [texDir, outDir, variant = 'small'] = process.argv.slice(2);
  const V = VARIANTS[variant], K = kit(V.H, layoutOf(texDir, variant));
  for (const [name, polys] of Object.entries(K.PIECES)) {
    const dir = path.join(outDir, name); fs.mkdirSync(dir, { recursive: true });
    const r = writeGltf(path.join(dir, `${V.prefix}_${name}_lod0.gltf`), mesh(polys));
    console.log(name.padEnd(7), 'verts', r.nv, 'tris', r.tris, 'min', r.mn.map(v => v.toFixed(2)).join(','), 'max', r.mx.map(v => v.toFixed(2)).join(','));
  }
}
