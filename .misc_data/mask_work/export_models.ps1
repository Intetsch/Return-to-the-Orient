# For each in-use atlas, find a unit cfg that uses it, take that cfg's body mesh (the
# first lod0), and convert it to glTF so the painter can show which part of the model a
# UV island belongs to.
#
# Mesh paths in the mod point at vanilla dlc06 (meshes were de-duplicated), so they are
# resolved against the game data folder.

# rdm4 logs to stderr; with -ErrorActionPreference Stop PowerShell escalates that to a
# terminating error even on exit code 0, so this script runs in Continue mode.
$ErrorActionPreference='Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$mod  = Split-Path (Split-Path $here -Parent) -Parent
$game = "D:\anno_data\1800"
$out  = Join-Path $here 'models'
New-Item -ItemType Directory -Force $out | Out-Null

# texture -> first cfg that references it
$cfgs = Get-ChildItem -LiteralPath "$mod\data\graphics\units\orient\inhabitants" -Recurse -File -Filter *.cfg
$texToCfg = @{}
foreach($c in $cfgs){
    $t=[System.IO.File]::ReadAllText($c.FullName)
    foreach($m in [regex]::Matches($t,'<cModelDiffTex>([^<]+)<')){
        $p=$m.Groups[1].Value -replace '\\','/'
        if($p -notmatch '^data/graphics/units/orient/'){ continue }
        $base=[System.IO.Path]::GetFileNameWithoutExtension($p)
        if(-not $texToCfg.ContainsKey($base)){ $texToCfg[$base]=$c.FullName }
    }
}

$manifestPath = Join-Path $here 'manifest.json'
$man = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

$rows=@()
foreach($entry in $man){
    $base=$entry.name
    $model=$null
    if($texToCfg.ContainsKey($base)){
        $cfgPath=$texToCfg[$base]
        $t=[System.IO.File]::ReadAllText($cfgPath)

        # the body mesh is the lod0 belonging to the MODEL whose material uses THIS texture;
        # in practice that is the first lod0 in the file, props come after
        $mm=[regex]::Match($t,'<FileName>([^<]+_lod0\.rdm)<')
        if($mm.Success){
            $rel=$mm.Groups[1].Value -replace '\\','/'
            $src=Join-Path $game ($rel -replace '/','\')
            if(Test-Path -LiteralPath $src){
                $dstName="$base.glb"
                $dst=Join-Path $out $dstName
                if(-not (Test-Path -LiteralPath $dst)){
                    & C:\Tools\rdm4-bin.exe -i $src -o $dst --force 2>$null | Out-Null
                }
                if(Test-Path -LiteralPath $dst){ $model=$dstName }
                else { Write-Output "  convert failed: $base" }
            } else { Write-Output "  mesh missing: $rel" }
        }
    }
    # a *_var_diff atlas is a recolour of its base atlas on the SAME mesh, and is only
    # referenced from a vehicle/building cfg, so no inhabitant cfg points at it. Borrow
    # the base atlas's model - identical UVs, which is all the viewer needs.
    if(-not $model -and $base -match '_var_diff$'){
        $alt = ($base -replace '_var_diff$','_diff') + '.glb'
        if(Test-Path -LiteralPath (Join-Path $out $alt)){ $model=$alt }
    }
    $rows += [pscustomobject]@{ name=$base; w=$entry.w; h=$entry.h; model=$model }
}

# Textures whose mesh file is byte-identical share a UV layout exactly, so a mask painted
# for one transfers to the others with no edits. Tag each with a group id so the painter
# can offer those as the safe "copy from" candidates.
$uv=@{}; $next=1
foreach($r in $rows){
    if(-not $r.model){ continue }
    $h=(Get-FileHash -LiteralPath (Join-Path $out $r.model) -Algorithm MD5).Hash
    if(-not $uv.ContainsKey($h)){ $uv[$h]=$next; $next++ }
}

# A few meshes are authored facing the opposite way, so a default front camera shows their
# back and the texture looks like it does not fit. Nothing is wrong with the UVs - these
# just need the preview turned 180 degrees. Verified by eye in the painter.
# Per-model yaw overrides.
# The adult meshes are authored facing -Z and the painter's camera sits on that side, so
# they need no rotation. The three child meshes face the opposite way (+Z) and would show
# the back of the head, which reads as a broken UV mapping -- it is not, the atlas fits
# fine once the model is turned round. Verified by eye for each.
$yaw = @{
    'residence_colony_02_tier_01_small_f_01_diff' = 180
    'residence_colony_02_tier_02_small_f_01_diff' = 180
    'residence_colony_02_tier02_small_m_01_diff'  = 180
}

$sb=New-Object System.Text.StringBuilder
[void]$sb.AppendLine('[')
for($i=0;$i -lt $rows.Count;$i++){
    $c = if($i -lt $rows.Count-1){','}else{''}
    $m = if($rows[$i].model){ '"'+$rows[$i].model+'"' } else { 'null' }
    $u = 0
    if($rows[$i].model){ $u = $uv[(Get-FileHash -LiteralPath (Join-Path $out $rows[$i].model) -Algorithm MD5).Hash] }
    $y = 0; if($yaw.ContainsKey($rows[$i].name)){ $y = $yaw[$rows[$i].name] }
    [void]$sb.AppendLine(('  {{"name":"{0}","w":{1},"h":{2},"model":{3},"uv":{4},"yaw":{5}}}{6}' -f $rows[$i].name,$rows[$i].w,$rows[$i].h,$m,$u,$y,$c))
}
[void]$sb.AppendLine(']')
[System.IO.File]::WriteAllText($manifestPath,$sb.ToString(),(New-Object System.Text.UTF8Encoding($false)))

$ok=($rows|Where-Object{$_.model}).Count
Write-Output "models converted: $ok / $($rows.Count)"
Get-ChildItem -LiteralPath $out | Select-Object Name,Length | Format-Table -AutoSize
