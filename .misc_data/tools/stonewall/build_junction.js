// Oriental Wall Junction meshes: one tile where a large and a small wall meet, as a large part (large kit/atlas) and a
// small part (small kit/atlas). The neighbour system cannot tell the two walls apart, so these are plain ornaments the
// player picks (variation) and turns; the walls list them as neighbours and run flush into their arms.
//   cross     large -x/+x through, small -z/+z
//   t_large   large -x/+x through, small branch -z
//   t_small   small -x/+x through, large branch -z (runs across the small wall, end face above it)
//   corner_a  large +x, small -z      corner_b  small +x, large -z (mirror pair: turning one never gives the other)
// Every arm ends in a cap at the tile edge, like the wall pieces; where a small wall passes a large one its faces are
// split, so no two faces overlap.
// node build_junction.js <texDir> <outDir>  -> <outDir>/<name>/stonewall_junction_<name>_{large,small}_lod0.gltf
const path = require('path'), fs = require('fs');
const VARIANTS = require('./variants.js');
const { kit, layoutOf, mesh, writeGltf, uFront, uBack, uRight, uLeft, T, h } = require('./build_wall.js');
const U_E = 0.3; // vertical end faces: a slice of the face band, u across the thickness along n x up

function junctions(S, K) {
  const largeMid = [K.side([-h, T], [h, T], [0, 0, 1], uFront), K.side([-h, -T], [h, -T], [0, 0, -1], uBack), K.top([[-h, -T], [h, -T], [h, T], [-h, T]], 'x+'), K.cap('-x'), K.cap('+x')];
  const smallStub = sz => sz < 0
    ? [S.side([-T, -h], [-T, -T], [-1, 0, 0], uLeft), S.side([T, -h], [T, -T], [1, 0, 0], uRight), S.top([[-T, -T], [-T, -h], [T, -h], [T, -T]], 'z-'), S.cap('-z')]
    : [S.side([-T, T], [-T, h], [-1, 0, 0], uLeft), S.side([T, T], [T, h], [1, 0, 0], uRight), S.top([[-T, T], [T, T], [T, h], [-T, h]], 'z+'), S.cap('+z')];
  return {
    cross: { large: largeMid, small: [...smallStub(-1), ...smallStub(1)] },
    t_large: { large: largeMid, small: smallStub(-1) },
    t_small: {
      large: [K.side([-T, -h], [-T, T], [-1, 0, 0], uLeft), K.side([T, -h], [T, T], [1, 0, 0], uRight),
        K.side([-T, T], [T, T], [0, 0, 1], p => U_E + (T - p[0])), K.top([[-T, -h], [T, -h], [T, T], [-T, T]], 'z-'), K.cap('-z')],
      small: [S.side([-h, T], [-T, T], [0, 0, 1], uFront), S.side([T, T], [h, T], [0, 0, 1], uFront),
        S.side([-h, -T], [-T, -T], [0, 0, -1], uBack), S.side([T, -T], [h, -T], [0, 0, -1], uBack),
        S.top([[-h, -T], [-T, -T], [-T, T], [-h, T]], 'x+'), S.top([[T, -T], [h, -T], [h, T], [T, T]], 'x+'), S.cap('-x'), S.cap('+x')],
    },
    corner_a: {
      large: [K.side([-T, T], [h, T], [0, 0, 1], uFront), K.side([-T, -T], [h, -T], [0, 0, -1], uBack),
        K.side([-T, -T], [-T, T], [-1, 0, 0], p => U_E + (T - p[2])), K.top([[-T, -T], [h, -T], [h, T], [-T, T]], 'x+'), K.cap('+x')],
      small: smallStub(-1),
    },
    corner_b: {
      large: [K.side([-T, -h], [-T, T], [-1, 0, 0], uLeft), K.side([T, -h], [T, T], [1, 0, 0], uRight),
        K.side([-T, T], [T, T], [0, 0, 1], p => U_E + (T - p[0])), K.top([[-T, -h], [T, -h], [T, T], [-T, T]], 'z-'), K.cap('-z')],
      small: [S.side([T, T], [h, T], [0, 0, 1], uFront), S.side([T, -T], [h, -T], [0, 0, -1], uBack), S.top([[T, -T], [h, -T], [h, T], [T, T]], 'x+'), S.cap('+x')],
    },
  };
}
// the wall piece each junction behaves like (ground decal, walker blockers, hit boxes)
const SHAPE = { cross: 'x', t_large: 't', t_small: 't', corner_a: 'corner', corner_b: 'corner' };

module.exports = { junctions, SHAPE };
if (require.main === module) {
  const [texDir, outDir] = process.argv.slice(2);
  const S = kit(VARIANTS.small.H, layoutOf(texDir, 'small')), K = kit(VARIANTS.large.H, layoutOf(texDir, 'large'));
  for (const [name, parts] of Object.entries(junctions(S, K))) for (const [part, polys] of Object.entries(parts)) {
    const dir = path.join(outDir, name); fs.mkdirSync(dir, { recursive: true });
    const r = writeGltf(path.join(dir, `stonewall_junction_${name}_${part}_lod0.gltf`), mesh(polys));
    console.log(`${name} ${part}`.padEnd(16), 'verts', r.nv, 'tris', r.tris, 'min', r.mn.map(v => v.toFixed(2)).join(','), 'max', r.mx.map(v => v.toFixed(2)).join(','));
  }
}
