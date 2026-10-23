// Retargets a .na2 sampled on one model onto another skeleton with the same bone names and hierarchy
// (Sick Emperor <- Emperor: Granny cannot sample any animation on the Sick Emperor's own model).
// Works on Granny skin transforms S(t) = IWT · W(t), which are rigid model-space motions, parents first:
// - each bone's motion relative to its parent, L_src = S_src · inverse(S_src_parent), is a rotation R about the bone's
//   bind pivot p_src that moves the pivot by d = p_src·L_src − p_src;
// - the target bone gets the same rotation about its own pivot and the same shift, then its parent's motion:
//   S_dst = L_dst · S_dst_parent, with L_dst: v -> (v − p_dst)·R + p_dst + d.
// So the eyes stay in the target's own sockets while the head moves. A bone the source lacks follows its parent,
// except under the root, which the pipeline never moves: those stay at the bind pose (the three medals).
// Written as W_dst(t) = inverse(IWT_dst) · S_dst so that IWT_dst · W_dst = S_dst. Row-vector matrices, translation last.
//
// node na2retarget.js src.cn6 src.na2 dst.cn6 out.na2
const fs = require('fs');
const { parseCn6, parseNa2 } = require('./animcheck.js');
const { inv4 } = require('./na2bind.js');
const mm = (A, B) => { const C = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) C[r * 4 + c] += A[r * 4 + k] * B[k * 4 + c]; return C; };
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const apply = (M, p) => [0, 1, 2].map(c => p[0] * M[c] + p[1] * M[4 + c] + p[2] * M[8 + c] + M[12 + c]);
// rotation part of M about pivot p, then shift d
function aboutPivot(M, p, d) {
  const R = [M[0], M[1], M[2], 0, M[4], M[5], M[6], 0, M[8], M[9], M[10], 0, 0, 0, 0, 1];
  const pr = apply(R, p);
  return [...R.slice(0, 12), p[0] - pr[0] + d[0], p[1] - pr[1] + d[1], p[2] - pr[2] + d[2], 1];
}

function retarget(srcCn6, srcNa2, dstCn6, outNa2) {
  const src = parseCn6(srcCn6), dst = parseCn6(dstCn6), na = parseNa2(srcNa2);
  const sIdx = {}; src.bones.forEach((b, i) => sIdx[b.name] = i);
  const n = na.hdr.FrameCount, shared = [], still = [], follow = [];
  const sPivot = src.bones.map(b => inv4(b.iwt).slice(12, 15)), dBind = dst.bones.map(b => inv4(b.iwt));
  const out = dst.bones.map(() => []);
  for (let k = 0; k < n; k++) {
    // source skin transforms this frame
    const S = src.bones.map(b => na.bones[b.name] ? mm(b.iwt, na.bones[b.name][Math.min(k, na.bones[b.name].length - 1)]) : null);
    const D = [];
    dst.bones.forEach((b, i) => {
      const si = sIdx[b.name], par = b.parent;
      if (si === undefined || !S[si]) {
        D[i] = par <= 0 ? I4 : D[par];
        if (k === 0) (par <= 0 ? still : follow).push(b.name);
      } else {
        const sp = src.bones[si].parent;
        const Ls = sp >= 0 && S[sp] ? mm(S[si], inv4(S[sp])) : S[si];
        const ps = sPivot[si], d = apply(Ls, ps).map((x, c) => x - ps[c]);
        const Ld = aboutPivot(Ls, dBind[i].slice(12, 15), d);
        D[i] = par >= 0 ? mm(Ld, D[par]) : Ld;
        if (k === 0) shared.push(b.name);
      }
      out[i].push(mm(dBind[i], D[i]));
    });
  }
  let body = ['// Nexus Buddy Animation NA2 - Exported from Nexus Buddy 2', 'FrameSets: 1', 'FrameCount: ' + n,
    'FirstFrame: ' + na.hdr.FirstFrame, 'LastFrame: ' + na.hdr.LastFrame, 'FPS: ' + na.hdr.FPS, 'Bones: ' + dst.bones.length].join('\r\n') + '\r\n';
  dst.bones.forEach((b, i) => { body += b.name + '\r\n' + out[i].map(W => W.map(x => x.toFixed(6)).join(' ') + ' \n').join(''); });
  fs.writeFileSync(outNa2, body, 'latin1');
  return { shared, still, follow };
}
module.exports = { retarget };
if (require.main === module) { const [a, b, c, d] = process.argv.slice(2); console.log(retarget(a, b, c, d)); }
