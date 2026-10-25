const {loadGltf,render}=require('./render');const PNG=require('./png');
const tag=process.argv[2]||'';const outs=[];
for (const t of ['01','02']) {
  const m=loadGltf('g'+t+'/out.gltf'); m.tex=PNG.decode('tex/resident_orient_tier'+t+'_diff_0.png');
  const b=loadGltf('body'+t+'/body.gltf'); b.tex=PNG.decode('body'+t+'/body_diff.png');
  for (const [name,yaw,pitch] of [['front',0,0],['game',-25,0]]) {const f='h'+t+'_'+name+'.png';render([m,b],{yaw,pitch,center:[0,10,10],scale:2.6,w:640,h:820,mirror:true},f);outs.push(f);}
}
require('child_process').execSync('node montage.js prevhi'+tag+'.png 4 '+outs.join(' '));