# Side-by-side sheet: vanilla Enbesa | Orient result | 1404 Orient reference,
# so the reskin can be judged against the thing it is meant to resemble.

$ErrorActionPreference='Continue'
Add-Type -AssemblyName System.Drawing
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$pairs = @(
  @('Woman T2',      'residence_colony_02_tier_02_normal_f_01_diff', 's_wealthy_female_worker_diff_0'),
  @('Woman T1',      'residence_colony_02_tier_01_large_f_01_diff',  's_citizen_04_d_diff_0'),
  @('Worker male T1','residence_colony_02_tier01_normal_m_01_diff',  's_common_worker_b_diff_0'),
  @('Citizen male T2','residence_colony_02_tier02_normal_m_01_diff', 's_citizen_01_diff_0'),
  @('Child',         'residence_colony_02_tier02_small_m_01_diff',   's_nomad01_a_diff_0')
)

$cell=170; $pad=8; $lh=15
$W = $pad + 3*($cell+$pad)
$H = $lh + $pairs.Count*($cell+$lh+$pad) + $pad
$bmp = New-Object System.Drawing.Bitmap($W,$H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode='HighQualityBicubic'
$g.Clear([System.Drawing.Color]::FromArgb(22,22,26))
$fn  = New-Object System.Drawing.Font('Segoe UI',7.5,[System.Drawing.FontStyle]::Bold)
$fn2 = New-Object System.Drawing.Font('Segoe UI',7)
$hb  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150,200,255))

$hdr = @('VANILLA ENBESA','ORIENT (from masks)','ANNO 1404 REFERENCE')
for($k=0;$k -lt 3;$k++){ $g.DrawString($hdr[$k],$fn,$hb,[single]($pad+$k*($cell+$pad)),[single]2) }

$y=$lh
foreach($p in $pairs){
  $g.DrawString($p[0],$fn2,[System.Drawing.Brushes]::White,[single]$pad,[single]$y)
  $srcs = @(
    (Join-Path $here "textures\$($p[1]).png"),
    (Join-Path $here "out_png\$($p[1]).png"),
    (Join-Path $here "ref1404\$($p[2]).png")
  )
  for($k=0;$k -lt 3;$k++){
    if(Test-Path -LiteralPath $srcs[$k]){
      $im=[System.Drawing.Image]::FromFile($srcs[$k])
      $g.DrawImage($im,(New-Object System.Drawing.Rectangle(($pad+$k*($cell+$pad)),($y+$lh),$cell,$cell)))
      $im.Dispose()
    } else {
      $g.DrawString('missing',$fn2,[System.Drawing.Brushes]::Gray,[single]($pad+$k*($cell+$pad)),[single]($y+$lh+20))
    }
  }
  $y += $cell+$lh+$pad
}
$out = Join-Path $here 'compare_1404.png'
$bmp.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output $out
