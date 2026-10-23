// front-view silhouette half-width per height for bust and body (max |x|), and in the game view (yaw -25)
const {loadGltf}=require('./render');
const yaws=[0,-25];
for(const t of ['01','02']){const m=loadGltf(`g${t}/out.gltf`),b=loadGltf(`body${t}/body.gltf`);
 console.log('tier',t);
 for(const yaw of yaws){const a=yaw*Math.PI/180;const X=(p)=>Math.cos(a)*p[0]-Math.sin(a)*(p[1]-10);
  const row=(ps,z)=>{const xs=ps.filter(p=>Math.abs(p[2]-z)<3).map(X);return xs.length?[Math.min(...xs).toFixed(0),Math.max(...xs).toFixed(0)]:['-','-'];};
  let line=`  yaw ${yaw}:`;for(const z of [-20,-10,0,10,20,30,45,60,80,100,120,140]){const u=row(m.pos,z),v=row(b.pos,z);line+=` z${z}[bust ${u.join('/')} body ${v.join('/')}]`;}
  console.log(line);}}
