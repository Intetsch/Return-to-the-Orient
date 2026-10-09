# Rebuild the Orient unit atlases from HAND-PAINTED region masks.
#
# This replaces the old statistical detector entirely. Every pixel's role comes from
# masks\<name>_mask.png, so faces, hair, cloth and leather are whatever you painted and
# nothing is inferred.
#
#   label 1 cloth    -> weave replaced with a geometric motif, tinted from the 1404 palette
#   label 2 skin     -> value/hue grade only
#   label 3 hair     -> men: untouched.  women: treated as CLOTH, i.e. a hijab
#   label 4 leather  -> warm grade, no motif
#   label 0 unset    -> untouched
#
# The palette is measured from Anno 1404's own Orient ("south") unit atlases rather than
# invented - see ref1404_palette.ps1. That set is ~88% warm (hue 8-68 deg) at saturation
# around 0.45, with deep red as a minor accent and blue only ever as a desaturated grey.

param(
    [switch]$WhatIf,
    [string]$Only = '',          # substring filter, for iterating on one texture
    [switch]$GirlsWearHijab,     # off: child girls keep their hair
    # Motif period multiplier. Everything in the motifs is derived from the period, so this
    # widens the lines and their spacing together. Units are small on screen and a fine
    # weave just reads as noise at game zoom, hence 3x.
    [double]$PatternScale = 3.0
)

$ErrorActionPreference='Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$mod  = Split-Path (Split-Path $here -Parent) -Parent
$texDir  = Join-Path $here 'textures'
$maskDir = Join-Path $here 'masks'
$outPng  = Join-Path $here 'out_png'
$work    = Join-Path $here '_work'
New-Item -ItemType Directory -Force $outPng,$work | Out-Null

$code = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class MaskReskin
{
    // ---- colour helpers ----
    static void RgbToHsl(double r,double g,double b,out double h,out double s,out double l){
        double mx=Math.Max(r,Math.Max(g,b)), mn=Math.Min(r,Math.Min(g,b));
        l=(mx+mn)/2.0; double d=mx-mn;
        if(d<1e-9){h=0;s=0;return;}
        s = l>0.5 ? d/(2.0-mx-mn) : d/(mx+mn);
        if(mx==r) h=((g-b)/d+(g<b?6.0:0.0)); else if(mx==g) h=((b-r)/d+2.0); else h=((r-g)/d+4.0);
        h*=60.0;
    }
    static double H2R(double p,double q,double t){
        if(t<0)t+=1; if(t>1)t-=1;
        if(t<1.0/6.0) return p+(q-p)*6.0*t;
        if(t<1.0/2.0) return q;
        if(t<2.0/3.0) return p+(q-p)*(2.0/3.0-t)*6.0;
        return p;
    }
    static void HslToRgb(double h,double s,double l,out double r,out double g,out double b){
        if(s<1e-9){r=g=b=l;return;}
        double q = l<0.5 ? l*(1+s) : l+s-l*s;
        double p = 2*l-q, hn=h/360.0;
        r=H2R(p,q,hn+1.0/3.0); g=H2R(p,q,hn); b=H2R(p,q,hn-1.0/3.0);
    }
    static double Frac(double v){ return v-Math.Floor(v); }
    static double Step(double e,double w,double v){ double t=(v-(e-w))/(2*w); return t<0?0:(t>1?1:t); }
    static double Smooth(double a,double b,double v){ double t=(v-a)/(b-a); if(t<0)t=0; if(t>1)t=1; return t*t*(3-2*t); }

    static double[] BoxBlur(double[] a,int w,int h,int r){
        double[] t=new double[w*h], o=new double[w*h];
        for(int y=0;y<h;y++){
            double sum=0; int cnt=0;
            for(int x=-r;x<=r;x++){ sum+=a[y*w+Math.Min(w-1,Math.Max(0,x))]; cnt++; }
            for(int x=0;x<w;x++){
                t[y*w+x]=sum/cnt;
                sum += a[y*w+Math.Min(w-1,x+r+1)] - a[y*w+Math.Min(w-1,Math.Max(0,x-r))];
            }
        }
        for(int x=0;x<w;x++){
            double sum=0; int cnt=0;
            for(int y=-r;y<=r;y++){ sum+=t[Math.Min(h-1,Math.Max(0,y))*w+x]; cnt++; }
            for(int y=0;y<h;y++){
                o[y*w+x]=sum/cnt;
                sum += t[Math.Min(h-1,y+r+1)*w+x] - t[Math.Min(h-1,Math.Max(0,y-r))*w+x];
            }
        }
        return o;
    }

    // ---- motifs ----
    static double MLattice(double x,double y,double T){
        double u=Frac((x+y)/T), v=Frac((x-y)/T);
        double lu=1.0-Step(0.10,0.035,Math.Abs(u-0.5));
        double lv=1.0-Step(0.10,0.035,Math.Abs(v-0.5));
        double du=Math.Abs(u-0.5), dv=Math.Abs(v-0.5);
        double dot=1.0-Step(0.16,0.05,Math.Sqrt(du*du+dv*dv));
        return Math.Max(Math.Max(lu,lv)*0.8, dot);
    }
    static double MStripe(double x,double y,double T){
        double u=Frac((x*0.9659+y*0.2588)/T);
        double wide=1.0-Step(0.17,0.03,u);
        double f1=Step(0.50,0.018,u)*(1.0-Step(0.545,0.018,u));
        double f2=Step(0.62,0.014,u)*(1.0-Step(0.655,0.014,u));
        return Math.Max(wide*0.85, Math.Max(f1,f2));
    }
    static double MWeave(double x,double y,double T){     // plain cloth, very fine
        double u=Frac(x/(T*0.22)), v=Frac(y/(T*0.22));
        return ((1.0-Step(0.5,0.45,u))*0.5 + (1.0-Step(0.5,0.45,v))*0.5)*0.35 + 0.30;
    }
    static double Motif(string m,double x,double y,double T){
        if(m=="lattice") return MLattice(x,y,T);
        if(m=="stripe")  return MStripe(x,y,T);
        return MWeave(x,y,T);
    }

    // Palette measured from the 1404 Orient atlases: {hue, sat, lightness-target}
    static double[][] PAL = new double[][]{
        new double[]{  22, 0.46, 0.44 },   // ochre / tan        (dominant, 44%)
        new double[]{  38, 0.45, 0.56 },   // gold / sand        (26%)
        new double[]{   8, 0.41, 0.38 },   // brick / terracotta (12%)
        new double[]{ 348, 0.33, 0.35 },   // deep red           (5%)
        new double[]{  68, 0.50, 0.30 },   // olive              (2%)
        new double[]{ 225, 0.11, 0.44 },   // grey-blue accent   (4%, note the low sat)
        new double[]{  38, 0.16, 0.64 },   // undyed linen / cream - the light piece that
                                           // gives 1404 figures their value contrast
    };
    // Draw weighted to the measured shares. The earlier 12-entry pool combined with a weak
    // hash handed grey-blue to a quarter of the crowd when it should be about one in
    // twenty-five, so the pool is finer-grained now.
    static int[] POOL = { 0,0,0,0,0,0,0,0,0,0,0,   // ochre   ~44%
                          1,1,1,1,1,1,             // gold    ~26%
                          2,2,2,                   // brick   ~12%
                          3,3,                     // deep red ~5%
                          4,                       // olive    ~2%
                          5 };                     // grey-blue ~4%

    // Skin measured from the 1404 Orient atlases: warm mid-tan, not the Enbesa deep brown.
    const double SKIN_H = 29.0, SKIN_S = 0.44, SKIN_L = 0.44;

    static int Mix(int h,int salt){            // cheap avalanche so adjacent names scatter
        unchecked{
            int x = h ^ (salt * unchecked((int)0x9E3779B1));
            x ^= (int)((uint)x >> 15); x *= unchecked((int)0x2C1B3C6D);
            x ^= (int)((uint)x >> 12); x *= unchecked((int)0x297A2D39);
            x ^= (int)((uint)x >> 15);
            return Math.Abs(x);
        }
    }

    public static void Run(string texPath,string maskPath,string outPath,string key,bool hijab,double patScale)
    {
        int hash=17; foreach(char c in key) hash=hash*31+c; hash=Math.Abs(hash);
        string[] motifs = { "lattice","weave","lattice","stripe","weave","lattice" };
        string mo = motifs[Mix(hash,1) % motifs.Length];
        int gi = POOL[Mix(hash,2) % POOL.Length];
        double[] garment = PAL[gi];
        // A hijab is a separate garment, so it must not land on the dress's own dye.
        // Step through the pool until a different palette entry comes up.
        int hi = POOL[Mix(hash,3) % POOL.Length];
        for(int t=0; hi==gi && t<POOL.Length; t++) hi = POOL[(Mix(hash,3)+t+1) % POOL.Length];
        double[] head = PAL[hi];

        using(Bitmap src=new Bitmap(texPath))
        using(Bitmap msk=new Bitmap(maskPath))
        {
            int w=src.Width,h=src.Height,px=w*h,n=px*4;
            Bitmap dst=new Bitmap(w,h,PixelFormat.Format32bppArgb);
            Rectangle rc=new Rectangle(0,0,w,h);
            var sd=src.LockBits(rc,ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
            var dd=dst.LockBits(rc,ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);
            byte[] buf=new byte[n]; Marshal.Copy(sd.Scan0,buf,0,n);

            // mask -> labels (nearest of the five painter colours)
            byte[] lab=new byte[px];
            using(Bitmap m2=new Bitmap(msk,new Size(w,h))){
                var md=m2.LockBits(rc,ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
                byte[] mb=new byte[n]; Marshal.Copy(md.Scan0,mb,0,n); m2.UnlockBits(md);
                int[][] LC={ new[]{0,0,0}, new[]{0,200,80}, new[]{230,140,90}, new[]{60,90,220}, new[]{230,200,60} };
                for(int p=0;p<px;p++){
                    int r=mb[p*4+2],g=mb[p*4+1],b=mb[p*4];
                    int best=0; double bd=1e9;
                    for(int k=0;k<LC.Length;k++){
                        double d=(r-LC[k][0])*(r-LC[k][0])+(g-LC[k][1])*(g-LC[k][1])+(b-LC[k][2])*(b-LC[k][2]);
                        if(d<bd){bd=d;best=k;}
                    }
                    lab[p]=(byte)best;
                }
            }

            double[] H=new double[px],S=new double[px],L=new double[px];
            for(int p=0;p<px;p++){
                double b0=buf[p*4]/255.0,g0=buf[p*4+1]/255.0,r0=buf[p*4+2]/255.0;
                double hh,ss,ll; RgbToHsl(r0,g0,b0,out hh,out ss,out ll);
                H[p]=hh;S[p]=ss;L[p]=ll;
            }

            // Fabric regions: cloth, plus women's hair when it becomes a hijab.
            // Shading is blurred WITHIN the region only (blur(L*m)/blur(m)), so folds are
            // kept without dragging skin tones across the garment edge.
            double[] mCloth=new double[px], mHijab=new double[px];
            for(int p=0;p<px;p++){
                mCloth[p] = (lab[p]==1)?1:0;
                mHijab[p] = (hijab && lab[p]==3)?1:0;
            }
            int R = Math.Max(8,(int)(w/22));
            double[] fab=new double[px];
            for(int p=0;p<px;p++) fab[p]=Math.Max(mCloth[p],mHijab[p]);
            double[] lm=new double[px];
            for(int p=0;p<px;p++) lm[p]=L[p]*fab[p];
            double[] lmB=BoxBlur(lm,w,h,R), fB=BoxBlur(fab,w,h,R);
            double[] baseL=new double[px];
            for(int p=0;p<px;p++) baseL[p] = fB[p]>1e-4 ? lmB[p]/fB[p] : L[p];

            double T=Math.Max(8.0,w/26.0)*patScale;

            // --- split the garment into its original pieces -------------------------
            // A 1404 figure wears several differently dyed pieces; dyeing the whole cloth
            // region one colour made every unit read as a single monochrome slab. The
            // Enbesa atlases already separate pieces by hue, so cluster the ORIGINAL hues
            // and give each cluster its own palette entry. Low-saturation cloth is kept as
            // a separate group and becomes the cream piece.
            // Cluster on a REGION-level hue, not the raw per-pixel hue. Clustering per
            // pixel re-coloured the old motif instead of replacing it: every zigzag element
            // differed in hue from its own background, so it landed in another cluster and
            // came back as orange and blue streaks tracing the original pattern.
            // Averaging hue as a vector (so 350 and 10 degrees average to 0, not 180) over a
            // radius wider than the motif leaves each garment piece's dominant hue.
            int RH = Math.Max(12,(int)(w/18));
            double[] hx=new double[px], hy=new double[px], hw=new double[px];
            for(int p=0;p<px;p++){
                bool isFab = lab[p]==1 || (hijab && lab[p]==3);
                if(!isFab || S[p]<0.10 || L[p]<0.10) continue;
                double a=H[p]*Math.PI/180.0;
                hx[p]=Math.Cos(a); hy[p]=Math.Sin(a); hw[p]=1;
            }
            double[] hxB=BoxBlur(hx,w,h,RH), hyB=BoxBlur(hy,w,h,RH), hwB=BoxBlur(hw,w,h,RH);
            double[] Hreg=new double[px];
            for(int p=0;p<px;p++){
                if(hwB[p]<1e-4){ Hreg[p]=H[p]; continue; }
                double a=Math.Atan2(hyB[p]/hwB[p], hxB[p]/hwB[p])*180.0/Math.PI;
                if(a<0)a+=360; Hreg[p]=a;
            }

            // region-level saturation, for spotting genuinely undyed cloth without
            // speckling on individual pale threads
            double[] sm0=new double[px];
            for(int p=0;p<px;p++) sm0[p] = (lab[p]==1 || (hijab&&lab[p]==3)) ? S[p] : 0;
            double[] smB=BoxBlur(sm0,w,h,RH);
            double[] fm0=new double[px];
            for(int p=0;p<px;p++) fm0[p] = (lab[p]==1 || (hijab&&lab[p]==3)) ? 1 : 0;
            double[] fmB=BoxBlur(fm0,w,h,RH);
            double[] Sreg=new double[px];
            for(int p=0;p<px;p++) Sreg[p] = fmB[p]>1e-4 ? smB[p]/fmB[p] : S[p];

            int HB=36;
            double[] hh2=new double[HB];
            for(int p=0;p<px;p++){
                if(lab[p]!=1 && !(hijab&&lab[p]==3)) continue;
                if(S[p]<0.10 || L[p]<0.10) continue;
                hh2[(int)(Hreg[p]/360.0*HB)%HB] += 1;
            }
            double[] sm=new double[HB];
            for(int i=0;i<HB;i++) sm[i]=hh2[(i+HB-1)%HB]*0.25+hh2[i]*0.5+hh2[(i+1)%HB]*0.25;
            // take up to three peaks at least 40 degrees apart
            var peaks=new System.Collections.Generic.List<double>();
            for(int t=0;t<3;t++){
                int bi=-1; double bv=0;
                for(int i=0;i<HB;i++){
                    if(sm[i]<=bv) continue;
                    double c=(i+0.5)*360.0/HB; bool near=false;
                    foreach(double q in peaks){ double d=Math.Abs(c-q); if(d>180)d=360-d; if(d<40){near=true;break;} }
                    if(!near){ bv=sm[i]; bi=i; }
                }
                if(bi<0||bv<=0) break;
                peaks.Add((bi+0.5)*360.0/HB);
            }
            if(peaks.Count==0) peaks.Add(30);

            // one palette entry per piece, all distinct
            int nPieces=peaks.Count;
            double[][] pieceCol=new double[nPieces][];
            var used=new System.Collections.Generic.List<int>();
            for(int t=0;t<nPieces;t++){
                int idx=POOL[Mix(hash,10+t) % POOL.Length];
                for(int g2=0; used.Contains(idx) && g2<PAL.Length; g2++) idx=(idx+1)%PAL.Length;
                used.Add(idx); pieceCol[t]=PAL[idx];
            }
            double[] creamCol = PAL[PAL.Length-1];

            // Skin is tone-MAPPED, not nudged. A fixed lightness bump left the Enbesa deep
            // brown still deep brown; instead the painted skin region's own mean is shifted
            // onto the 1404 reference tone while its relative shading is preserved.
            double skinMean=0; int skinN=0;
            for(int p=0;p<px;p++) if(lab[p]==2){ skinMean+=L[p]; skinN++; }
            skinMean = skinN>0 ? skinMean/skinN : SKIN_L;

            for(int y=0;y<h;y++) for(int x=0;x<w;x++){
                int p=y*w+x, i=p*4;
                double hh=H[p],ss=S[p],ll=L[p];
                double H2=hh,S2=ss,L2=ll;
                byte k=lab[p];
                bool isHijab = hijab && k==3;

                if(k==1 || isHijab){
                    double[] pal;
                    if(isHijab){ pal = head; }
                    else if(Sreg[p] < 0.12){ pal = creamCol; }   // genuinely undyed piece
                    else {
                        // region hue, so a piece gets one dye and the old motif inside it
                        // does not survive as colour banding
                        int bestP=0; double bd=999;
                        for(int t=0;t<nPieces;t++){
                            double d=Math.Abs(Hreg[p]-peaks[t]); if(d>180)d=360-d;
                            if(d<bd){bd=d;bestP=t;}
                        }
                        pal = pieceCol[bestP];
                    }
                    // a hijab is plain cloth; a garment carries the chosen motif
                    double P = isHijab ? MWeave(x,y,T) : Motif(mo,x,y,T);
                    // Keep most of the painted fold structure. Pulling hard toward a flat
                    // palette value made garments read as featureless slabs the same value
                    // as the skin, so the whole figure went monochrome.
                    double target = pal[2];
                    // and hold garment value clear of the skin tone, or the silhouette
                    // disappears: 1404 gets its separation from value, not just hue
                    if(Math.Abs(target-SKIN_L) < 0.10) target += (target<SKIN_L ? -0.10 : 0.10);
                    double folds = baseL[p]*0.62 + target*0.38;
                    double shaped = folds*(0.86+0.28*P);
                    if(shaped>1) shaped=1;
                    H2 = pal[0];
                    S2 = pal[1]*(0.80+0.35*P);
                    L2 = shaped;
                }
                else if(k==2){                      // skin
                    L2 = SKIN_L + (ll - skinMean)*0.85;   // keep modelling, move the mean
                    if(L2<0.06) L2=0.06; if(L2>0.97) L2=0.97;
                    S2 = ss + (SKIN_S - ss)*0.70;
                    double d=SKIN_H-hh; while(d>180)d-=360; while(d<-180)d+=360;
                    H2 = hh + d*0.80;
                }
                else if(k==4){                      // leather / metal
                    double d=28-hh; while(d>180)d-=360; while(d<-180)d+=360;
                    H2 = hh + d*0.35;
                    S2 = ss*0.95;
                    L2 = ll + 0.05*(1-ll);
                }
                // k==0 untouched, k==3 for men untouched

                if(S2<0)S2=0; if(S2>1)S2=1; if(L2<0)L2=0; if(L2>1)L2=1;
                double r1,g1,b1; HslToRgb(H2,S2,L2,out r1,out g1,out b1);
                buf[i]  =(byte)Math.Max(0,Math.Min(255,Math.Round(b1*255)));
                buf[i+1]=(byte)Math.Max(0,Math.Min(255,Math.Round(g1*255)));
                buf[i+2]=(byte)Math.Max(0,Math.Min(255,Math.Round(r1*255)));
            }

            Marshal.Copy(buf,0,dd.Scan0,n);
            src.UnlockBits(sd); dst.UnlockBits(dd);
            dst.Save(outPath,ImageFormat.Png); dst.Dispose();
            Console.WriteLine("motif="+mo+" garment="+garment[0]+" head="+(hijab?head[0].ToString():"-"));
        }
    }
}
'@
if(-not ("MaskReskin" -as [type])){ Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing -ErrorAction Stop }

$man = Get-Content -LiteralPath (Join-Path $here 'manifest.json') -Raw | ConvertFrom-Json

# Which atlases are women. Child girls only get a hijab if asked for.
function IsAdultFemale($n){ return ($n -match '_(large|normal)_f_0') -or ($n -match 'normal_f_0') }
function IsChildFemale($n){ return $n -match '_small_f_0' }

$rows=@(); $fail=@()
foreach($e in $man){
    if($Only -and ($e.name -notlike "*$Only*")){ continue }
    $tex  = Join-Path $texDir  "$($e.name).png"
    $mask = Join-Path $maskDir "$($e.name)_mask.png"
    if(-not (Test-Path -LiteralPath $tex)){  $fail+="$($e.name): no texture";  continue }
    if(-not (Test-Path -LiteralPath $mask)){ $fail+="$($e.name): no mask";     continue }

    $hij = (IsAdultFemale $e.name) -or ($GirlsWearHijab -and (IsChildFemale $e.name))
    $out = Join-Path $outPng "$($e.name).png"
    if($WhatIf){ $rows += [pscustomobject]@{Name=$e.name;Hijab=$hij}; continue }
    $info = [MaskReskin]::Run($tex,$mask,$out,$e.name,[bool]$hij,$PatternScale)
    $rows += [pscustomobject]@{ Name=($e.name -replace '^residence_colony_02_',''); Hijab=$hij }
}

if($WhatIf){ $rows | Format-Table -AutoSize; return }
Write-Output "graded: $($rows.Count)   failed: $($fail.Count)"
$fail | ForEach-Object { "  $_" }
$rows | Format-Table -AutoSize
