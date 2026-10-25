const {decode}=require('./png.js');
for(const f of process.argv.slice(2)){const im=decode(f);const {w,h,data}=im;let ah=new Array(9).fill(0);let opaqueCols={};let sumR=0,sumG=0,sumB=0,n=0;let whiteOpaque=0,darkOpaque=0;let minx=w,miny=h,maxx=0,maxy=0;
for(let i=0;i<w*h;i++){const a=data[i*4+3];ah[Math.min(8,a>>5)]++;if(a>200){const r=data[i*4],g=data[i*4+1],b=data[i*4+2];if(r+g+b>700)whiteOpaque++;if(r+g+b<250){darkOpaque++;sumR+=r;sumG+=g;sumB+=b;n++;}}
if(a>20){const x=i%w,y=(i/w)|0;minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);}}
console.log(f.split(/[\/]/).pop(),w,h,'alphaHist',ah.join(','),'whiteOpaque',whiteOpaque,'darkOpaque',darkOpaque,'darkAvg',(sumR/n|0),(sumG/n|0),(sumB/n|0),'bbox',minx,miny,maxx,maxy);
// sample colors of semi-transparent pixels
let s={};for(let i=0;i<w*h;i++){const a=data[i*4+3];if(a>30&&a<200){const k=(data[i*4]>>4)+','+(data[i*4+1]>>4)+','+(data[i*4+2]>>4);s[k]=(s[k]||0)+1;}}
console.log(' semi top colors',Object.entries(s).sort((a,b)=>b[1]-a[1]).slice(0,6).map(e=>e.join(':')).join(' '));}
