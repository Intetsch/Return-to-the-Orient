// For each angle around the body axis, intersect the bust with the half-plane and find the lowest surface point.
const {loadGltf}=require('./render');
function rimProfile(m, yc, N, zmin) {
  const out=[];
  for(let k=0;k<N;k++){
    const th=(k/N)*2*Math.PI-Math.PI; // -pi..pi, 0 = front (-y)
    const d=[Math.sin(th),-Math.cos(th)], n=[Math.cos(th),Math.sin(th)]; // n perpendicular
    let best=null;
    for(let t=0;t<m.idx.length;t+=3){
      const ids=[m.idx[t],m.idx[t+1],m.idx[t+2]];
      const P=ids.map(i=>m.pos[i]);
      if(Math.max(...P.map(p=>p[2]))<zmin)continue;
      const s=P.map(p=>p[0]*n[0]+(p[1]-yc)*n[1]);
      const pts=[];
      for(let e=0;e<3;e++){const a=e,b=(e+1)%3;if((s[a]<0)!==(s[b]<0)){const f=s[a]/(s[a]-s[b]);pts.push({a:ids[a],b:ids[b],f});}}
      for(const q of pts){
        const p=[0,1,2].map(c=>m.pos[q.a][c]*(1-q.f)+m.pos[q.b][c]*q.f);
        const r=p[0]*d[0]+(p[1]-yc)*d[1]; if(r<=0)continue;
        if(!best||p[2]>best.p[2]){
          const lerp=arr=>arr[q.a].map((v,c)=>v*(1-q.f)+arr[q.b][c]*q.f);
          best={p,r,z:p[2],uv:lerp(m.uv),nrm:lerp(m.nrm),tri:t,other:pts.filter(o=>o!==q)};
          // direction of surface upward along the cut: other intersection point of this triangle
          const o=pts.find(o=>o!==q); if(o){const po=[0,1,2].map(c=>m.pos[o.a][c]*(1-o.f)+m.pos[o.b][c]*o.f);best.up={r:po[0]*d[0]+(po[1]-yc)*d[1],z:po[2],uv:m.uv[o.a].map((v,c)=>v*(1-o.f)+m.uv[o.b][c]*o.f)};}
        }
      }
    }
    out.push({th,best});
  }
  return out;
}
module.exports={rimProfile};
if(require.main===module){
  const t=process.argv[2],yc=+process.argv[3];const m=loadGltf(`g${t}/out.gltf`);
  const prof=rimProfile(m,yc,72,-60);
  for(const {th,best} of prof){console.log((th*180/Math.PI).toFixed(0).padStart(5), best?`r ${best.r.toFixed(1).padStart(6)} z ${best.z.toFixed(1).padStart(6)} uv ${best.uv.map(v=>v.toFixed(3)).join(',')} up ${best.up?best.up.r.toFixed(1)+','+best.up.z.toFixed(1):''}`:'-');}
}

// UV of the outermost surface point at height z on the half-plane at angle th, using only the given triangles
// (start indices into m.idx). Used to sample the garment some distance above the rim.
function cutUV(m, yc, th, z, tris) {
  const d = [Math.sin(th), -Math.cos(th)], n = [Math.cos(th), Math.sin(th)];
  let best = null;
  for (const t of tris) {
    const ids = [m.idx[t], m.idx[t + 1], m.idx[t + 2]], P = ids.map(i => m.pos[i]);
    const s = P.map(p => p[0] * n[0] + (p[1] - yc) * n[1]);
    const pts = [];
    for (let e = 0; e < 3; e++) { const a = e, b = (e + 1) % 3; if ((s[a] < 0) !== (s[b] < 0)) { const f = s[a] / (s[a] - s[b]); pts.push({ a: ids[a], b: ids[b], f }); } }
    if (pts.length !== 2) continue;
    const Q = pts.map(q => ({ p: [0, 1, 2].map(c => m.pos[q.a][c] * (1 - q.f) + m.pos[q.b][c] * q.f), uv: [0, 1].map(c => m.uv[q.a][c] * (1 - q.f) + m.uv[q.b][c] * q.f) }));
    const z0 = Q[0].p[2], z1 = Q[1].p[2];
    if ((z0 - z) * (z1 - z) > 0 || z0 === z1) continue;
    const f = (z - z0) / (z1 - z0), p = Q[0].p.map((v, c) => v * (1 - f) + Q[1].p[c] * f);
    const r = p[0] * d[0] + (p[1] - yc) * d[1]; if (r <= 0) continue;
    if (!best || r > best.r) best = { r, uv: Q[0].uv.map((v, c) => v * (1 - f) + Q[1].uv[c] * f) };
  }
  return best;
}
// triangles connected (by welded position) to the triangle starting at index t0
function componentTris(m, t0) {
  const key = p => p.map(v => v.toFixed(3)).join(','), wid = new Map(), w = m.pos.map(p => { const k = key(p); if (!wid.has(k)) wid.set(k, wid.size); return wid.get(k); });
  const par = [...Array(wid.size).keys()], f = x => par[x] === x ? x : (par[x] = f(par[x]));
  for (let i = 0; i < m.idx.length; i += 3) { const a = f(w[m.idx[i]]), b = f(w[m.idx[i + 1]]); par[b] = a; par[f(w[m.idx[i + 2]])] = a; }
  const root = f(w[m.idx[t0]]), out = [];
  for (let i = 0; i < m.idx.length; i += 3) if (f(w[m.idx[i]]) === root) out.push(i);
  return out;
}
module.exports.cutUV = cutUV;
module.exports.componentTris = componentTris;

// Like rimProfile, but at the given angles, and it also reports the mesh edge (vertex indices ea, eb) the lowest point lies on.
function rimCuts(m, yc, angles, zmin) {
  return angles.map(th => {
    const d = [Math.sin(th), -Math.cos(th)], n = [Math.cos(th), Math.sin(th)];
    let best = null;
    for (let t = 0; t < m.idx.length; t += 3) {
      const ids = [m.idx[t], m.idx[t + 1], m.idx[t + 2]], P = ids.map(i => m.pos[i]);
      if (Math.max(...P.map(p => p[2])) < zmin) continue;
      const s = P.map(p => p[0] * n[0] + (p[1] - yc) * n[1]);
      const pts = [];
      for (let e = 0; e < 3; e++) { const a = e, b = (e + 1) % 3; if ((s[a] < 0) !== (s[b] < 0)) { const f = s[a] / (s[a] - s[b]); pts.push({ a: ids[a], b: ids[b], f }); } }
      for (const q of pts) {
        const p = [0, 1, 2].map(c => m.pos[q.a][c] * (1 - q.f) + m.pos[q.b][c] * q.f);
        const r = p[0] * d[0] + (p[1] - yc) * d[1]; if (r <= 0) continue;
        if (!best || p[2] > best.z) {
          const lerp = arr => arr[q.a].map((v, c) => v * (1 - q.f) + arr[q.b][c] * q.f);
          best = { p, r, z: p[2], uv: lerp(m.uv), nrm: lerp(m.nrm), tri: t, ea: q.a, eb: q.b, f: q.f };
          const o = pts.find(o => o !== q);
          if (o) { const po = [0, 1, 2].map(c => m.pos[o.a][c] * (1 - o.f) + m.pos[o.b][c] * o.f); best.up = { r: po[0] * d[0] + (po[1] - yc) * d[1], z: po[2], uv: m.uv[o.a].map((v, c) => v * (1 - o.f) + m.uv[o.b][c] * o.f) }; }
        }
      }
    }
    return { th, best };
  });
}
module.exports.rimCuts = rimCuts;
