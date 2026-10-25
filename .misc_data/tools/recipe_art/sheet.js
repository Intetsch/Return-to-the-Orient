// contact sheet: node sheet.js out.png scale bgR,bgG,bgB file1 file2 ...
const {decode,encode}=require('./png.js');
const [,, out, sc, bg, ...files]=process.argv; const S=+sc; const B=bg.split(',').map(Number);
const ims=files.map(f=>decode(f)); const cw=Math.max(...ims.map(i=>i.w))*S+8, ch=Math.max(...ims.map(i=>i.h))*S+8;
const cols=Math.min(3,ims.length), rows=Math.ceil(ims.length/cols); const W=cols*cw, H=rows*ch; const d=Buffer.alloc(W*H*4);
for(let i=0;i<W*H;i++){d[i*4]=B[0];d[i*4+1]=B[1];d[i*4+2]=B[2];d[i*4+3]=255;}
ims.forEach((im,k)=>{const ox=(k%cols)*cw+4, oy=Math.floor(k/cols)*ch+4;for(let y=0;y<im.h*S;y++)for(let x=0;x<im.w*S;x++){const si=((y/S|0)*im.w+(x/S|0))*4, di=((oy+y)*W+ox+x)*4, a=im.data[si+3]/255;for(let c=0;c<3;c++)d[di+c]=Math.round(im.data[si+c]*a+d[di+c]*(1-a));}});
encode(out,W,H,d);
