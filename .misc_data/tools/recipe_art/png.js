const fs=require('fs'),zlib=require('zlib');
function decode(p){const b=fs.readFileSync(p);let o=8,w,h,ct,bd,idat=[];while(o<b.length){const len=b.readUInt32BE(o),type=b.toString('ascii',o+4,o+8),d=b.slice(o+8,o+8+len);if(type=='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];}else if(type=='IDAT')idat.push(d);o+=12+len;}
const raw=zlib.inflateSync(Buffer.concat(idat));const bpp={6:4,2:3,0:1,4:2}[ct];const stride=w*bpp;const out=Buffer.alloc(w*h*4);let prev=Buffer.alloc(stride);
for(let y=0;y<h;y++){const f=raw[y*(stride+1)];const line=Buffer.from(raw.slice(y*(stride+1)+1,(y+1)*(stride+1)));for(let x=0;x<stride;x++){const a=x>=bpp?line[x-bpp]:0,up=prev[x],c=x>=bpp?prev[x-bpp]:0;let v=line[x];if(f==1)v+=a;else if(f==2)v+=up;else if(f==3)v+=(a+up)>>1;else if(f==4){const pp=a+up-c,pa=Math.abs(pp-a),pb=Math.abs(pp-up),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?up:c);}line[x]=v&255;}
for(let x=0;x<w;x++){const i=(y*w+x)*4;if(ct==6){line.copy(out,i,x*4,x*4+4);}else if(ct==2){out[i]=line[x*3];out[i+1]=line[x*3+1];out[i+2]=line[x*3+2];out[i+3]=255;}else if(ct==0){out[i]=out[i+1]=out[i+2]=line[x];out[i+3]=255;}else{out[i]=out[i+1]=out[i+2]=line[x*2];out[i+3]=line[x*2+1];}}prev=line;}
return {w,h,data:out};}
function crc32(buf){let c,crc=0xffffffff;for(let n=0;n<buf.length;n++){c=(crc^buf[n])&255;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return (crc^0xffffffff)>>>0;}
function encode(p,w,h,data){const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;data.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));return Buffer.concat([l,td,c]);};
const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;ih[10]=0;ih[11]=0;ih[12]=0;
fs.writeFileSync(p,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));}
module.exports={decode,encode};
