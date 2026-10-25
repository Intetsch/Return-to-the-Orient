// unlit close-ups at the seam; sharpness (mean |Laplacian|) of bust cloth above vs body below, and braid brightness
const {loadGltf,render}=require('./render');const PNG=require('./png');
const tag=process.argv[2]||'';const outs=[];
for(const t of ['01','02']){
 const m=loadGltf(`g${t}/out.gltf`); m.tex=PNG.decode(`tex/resident_orient_tier${t}_diff_0.png`);
 const b=loadGltf(`body${t}/body.gltf`); b.tex=PNG.decode(`body${t}/body_diff.png`);
 const S=5, cz=t==='01'?30:10, f=`sh${t}.png`;
 render([m,b],{yaw:0,pitch:0,center:[0,10,cz],scale:S,w:900,h:500,mirror:true,unlit:true},f);outs.push(f);
 const im=PNG.decode(f);const L=(x,y)=>{const o=(y*im.w+x)*4;return 0.3*im.data[o]+0.59*im.data[o+1]+0.11*im.data[o+2];};
 const lap=(X0,X1,z0,z1)=>{let s=0,n=0;for(let z=z0;z<z1;z+=0.25)for(let X=X0;X<X1;X+=0.25){const x=Math.round(450-X*S),y=Math.round(250+(z-cz)*S);if(x<2||y<2||x>=im.w-2||y>=im.h-2)continue;
   s+=Math.abs(4*L(x,y)-L(x-1,y)-L(x+1,y)-L(x,y-1)-L(x,y+1));n++;}return (s/n).toFixed(2);};
 if(t==='01') console.log('nomad sharpness: bust robe',lap(-75,-45,-2,8),'/',lap(45,75,-2,8),' body',lap(-75,-45,40,70),'/',lap(45,75,40,70),'/',lap(-20,20,40,70));
}
require('child_process').execSync(`node montage.js sharp${tag}.png 1 ${outs.join(' ')}`);
