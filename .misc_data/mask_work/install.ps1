# Encode out_png\*.png to BC7 with the full LOD chain and copy them over the mod's
# textures. Destination is derived from the mod's own cfg files, so nothing is hardcoded.

$ErrorActionPreference='Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$mod  = Split-Path (Split-Path $here -Parent) -Parent
$src  = Join-Path $here 'out_png'
$work = Join-Path $here '_enc'
New-Item -ItemType Directory -Force -Path $work | Out-Null

# texture basename -> folder inside the mod, read from the cfgs that reference it
$dest=@{}
# vehicle cfgs are included too: the *_var_diff atlas is referenced only from the fuel
# transport, so scanning the inhabitants folder alone misses it
$scanRoots = @("$mod\data\graphics\units\orient\inhabitants","$mod\data\graphics\vehicle\orient")
$allCfg = @()
foreach($r in $scanRoots){ if(Test-Path -LiteralPath $r){ $allCfg += Get-ChildItem -LiteralPath $r -Recurse -File -Filter *.cfg } }
foreach($c in $allCfg){
    $t=[System.IO.File]::ReadAllText($c.FullName)
    foreach($m in [regex]::Matches($t,'<cModelDiffTex>([^<]+)<')){
        $p=$m.Groups[1].Value -replace '\\','/'
        if($p -notmatch '^data/graphics/units/orient/'){ continue }
        $base=[System.IO.Path]::GetFileNameWithoutExtension($p)
        if(-not $dest.ContainsKey($base)){
            $dest[$base] = Split-Path (Join-Path $mod ($p -replace '/','\')) -Parent
        }
    }
}

$ok=0; $fail=@()
foreach($f in Get-ChildItem -LiteralPath $src -Filter *.png){
    $base=$f.BaseName
    if(-not $dest.ContainsKey($base)){ $fail+="$base :: no cfg references it"; continue }
    $dir=$dest[$base]
    $lods=(Get-ChildItem -LiteralPath $dir -File -Filter "$base`_*.dds" | Where-Object {$_.BaseName -match '_\d$'}).Count
    if($lods -lt 1){ $fail+="$base :: no existing LODs in $dir"; continue }

    $stage=Join-Path $work $base
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $stage "$base.png") -Force

    Push-Location -LiteralPath $stage
    & C:\Tools\annotex.exe "-f=diff" "-l=$lods" "$base.png" > $null 2>&1
    Pop-Location

    $made=0
    for($l=0;$l -lt $lods;$l++){
        $g=Join-Path $stage "$base`_$l.dds"
        if(Test-Path -LiteralPath $g){ Copy-Item -LiteralPath $g -Destination (Join-Path $dir "$base`_$l.dds") -Force; $made++ }
    }
    if($made -ne $lods){ $fail+="$base :: wanted $lods LODs, got $made"; continue }
    $ok++
    Write-Output ("  {0,-52} {1} LODs" -f $base,$made)
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Output ""
Write-Output "installed: $ok   failed: $($fail.Count)"
$fail | ForEach-Object { "  $_" }
