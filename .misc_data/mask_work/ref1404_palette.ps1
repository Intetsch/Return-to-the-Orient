# Decode a representative set of Anno 1404 Orient ("south") unit atlases and measure the
# palette their clothing actually uses, so the 1800 reskin is matched to the real thing
# rather than to my guess at it.
#
# Output: ref1404\*.png (decoded atlases) and a hue histogram printed to the console.

$ErrorActionPreference='Continue'
Add-Type -AssemblyName System.Drawing
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$g    = "D:\anno_data\1404\data\graphics\units"
$out  = Join-Path $here 'ref1404'
New-Item -ItemType Directory -Force $out | Out-Null

$srcs = @(
  "$g\population\south\citizen\maps\s_citizen_01_diff_0.dds",
  "$g\population\south\citizen\maps\s_citizen_02_c_diff_0.dds",
  "$g\population\south\citizen\maps\s_citizen_03_diff_0.dds",
  "$g\population\south\citizen\maps\s_citizen_04_d_diff_0.dds",
  "$g\population\south\nomad\maps\s_nomad01_a_diff_0.dds",
  "$g\population\south\nomad\maps\s_nomad03_d_diff_0.dds",
  "$g\feedback\south\wealthy_female_worker\maps\s_wealthy_female_worker_diff_0.dds",
  "$g\feedback\south\common_worker_orient\maps\s_common_worker_orient_diff_0.dds",
  "$g\feedback\south\bedouin\maps\s_bedouin_diff_0.dds",
  "$g\feedback\south\imam01\maps\s_imam01_diff_0.dds"
)

$got=@()
foreach($s in $srcs){
    if(-not (Test-Path -LiteralPath $s)){
        # name varies between folders; take whatever _diff_0.dds the folder has
        $dir = Split-Path $s -Parent
        if(Test-Path -LiteralPath $dir){
            $alt = Get-ChildItem -LiteralPath $dir -Filter '*_diff_0.dds' | Select-Object -First 1
            if($alt){ $s = $alt.FullName } else { Write-Output "  none in $dir"; continue }
        } else { Write-Output "  missing dir: $dir"; continue }
    }
    & C:\Tools\texconv.exe -ft png -y -o $out -- $s > $null 2>&1
    $png = Join-Path $out ([System.IO.Path]::GetFileNameWithoutExtension($s) + '.png')
    if(Test-Path -LiteralPath $png){ $got += $png }
}
Write-Output "decoded: $($got.Count)"

# ---- hue histogram over cloth-ish pixels ----
$bins = 24
$cnt  = New-Object 'double[]' $bins
$satS = New-Object 'double[]' $bins
$litS = New-Object 'double[]' $bins
$total = 0.0
foreach($p in $got){
    $bm = New-Object System.Drawing.Bitmap($p)
    $w=$bm.Width; $h=$bm.Height
    $rc = New-Object System.Drawing.Rectangle(0,0,$w,$h)
    $bd = $bm.LockBits($rc,[System.Drawing.Imaging.ImageLockMode]::ReadOnly,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $n = $w*$h*4
    $buf = New-Object byte[] $n
    [System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0,$buf,0,$n)
    $bm.UnlockBits($bd); $bm.Dispose()
    for($i=0;$i -lt $n;$i+=16){        # sample every 4th pixel
        $b=$buf[$i]/255.0; $gg=$buf[$i+1]/255.0; $r=$buf[$i+2]/255.0; $a=$buf[$i+3]
        if($a -lt 128){ continue }
        $mx=[Math]::Max($r,[Math]::Max($gg,$b)); $mn=[Math]::Min($r,[Math]::Min($gg,$b))
        $l=($mx+$mn)/2.0; $c=$mx-$mn
        if($l -lt 0.10 -or $l -gt 0.97){ continue }   # skip black holes and blowouts
        if($c -lt 0.04){ continue }                   # skip neutrals, counted separately
        $s = if($l -gt 0.5){ $c/(2.0-$mx-$mn) } else { $c/($mx+$mn) }
        if($mx -eq $r){ $hu = (($gg-$b)/$c + $(if($gg -lt $b){6}else{0})) }
        elseif($mx -eq $gg){ $hu = (($b-$r)/$c + 2) }
        else { $hu = (($r-$gg)/$c + 4) }
        $hu *= 60
        $bi = [int]([Math]::Floor($hu/360.0*$bins)) % $bins
        $cnt[$bi]++; $satS[$bi]+=$s; $litS[$bi]+=$l; $total++
    }
}

Write-Output ""
Write-Output ("{0,-12} {1,7} {2,7} {3,7}" -f 'HUE','SHARE','meanSat','meanLit')
Write-Output ("{0,-12} {1,7} {2,7} {3,7}" -f ('-'*12),('-'*7),('-'*7),('-'*7))
for($i=0;$i -lt $bins;$i++){
    if($cnt[$i] -lt 1){ continue }
    $share = 100.0*$cnt[$i]/$total
    if($share -lt 1.0){ continue }
    $hc = [int](($i+0.5)*360.0/$bins)
    Write-Output ("{0,-12} {1,6:N1}% {2,7:N2} {3,7:N2}" -f ("$hc deg"), $share, ($satS[$i]/$cnt[$i]), ($litS[$i]/$cnt[$i]))
}
Write-Output ""
Write-Output "sampled pixels: $total"
