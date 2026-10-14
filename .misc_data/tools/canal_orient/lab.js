// sRGB <-> Lab helpers
function s2l(c){c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
function l2s(c){c=c<=0.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-0.055;return Math.max(0,Math.min(255,Math.round(c*255)));}
const Xn=0.95047,Yn=1,Zn=1.08883;
function f(t){return t>216/24389?Math.cbrt(t):(24389/27*t+16)/116;}
function fi(t){return t*t*t>216/24389?t*t*t:(116*t-16)/(24389/27);}
function rgb2lab(r,g,b){r=s2l(r);g=s2l(g);b=s2l(b);
 const X=(0.4124*r+0.3576*g+0.1805*b)/Xn,Y=(0.2126*r+0.7152*g+0.0722*b)/Yn,Z=(0.0193*r+0.1192*g+0.9505*b)/Zn;
 const fx=f(X),fy=f(Y),fz=f(Z);return [116*fy-16,500*(fx-fy),200*(fy-fz)];}
function lab2rgb(L,a,b){const fy=(L+16)/116,fx=fy+a/500,fz=fy-b/200;
 const X=fi(fx)*Xn,Y=fi(fy)*Yn,Z=fi(fz)*Zn;
 const r=3.2406*X-1.5372*Y-0.4986*Z,g=-0.9689*X+1.8758*Y+0.0415*Z,bb=0.0557*X-0.2040*Y+1.0570*Z;
 return [l2s(r),l2s(g),l2s(bb)];}
module.exports={rgb2lab,lab2rgb};
