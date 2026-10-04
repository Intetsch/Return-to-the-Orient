const PNG=require('./png');
// usage: node montage.js out.png cols a.png b.png ...
const [out,cols,...files]=process.argv.slice(2);const ims=files.map(f=>PNG.decode(f));
const cw=Math.max(...ims.map(i=>i.w)),chh=Math.max(...ims.map(i=>i.h)),C=+cols,R=Math.ceil(ims.length/C);
const o=PNG.create(cw*C,chh*R,[0,0,0,255]);
ims.forEach((im,k)=>{const ox=(k%C)*cw,oy=Math.floor(k/C)*chh;for(let y=0;y<im.h;y++)im.data.copy(o.data,((oy+y)*o.w+ox)*4,y*im.w*4,(y+1)*im.w*4);});
PNG.encode(out,o,false);
