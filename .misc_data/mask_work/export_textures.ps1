# Re-export the vanilla source texture for every in-use Orient unit atlas, as PNG,
# into .\textures\ for the mask painter.
#
# Lives in the repo rather than a temp folder because the system temp gets cleaned and
# took the previous working set with it.

$ErrorActionPreference='Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$mod  = Split-Path (Split-Path $here -Parent) -Parent
$game = "D:\anno_data\1800"
$texOut = Join-Path $here 'textures'
New-Item -ItemType Directory -Force $texOut | Out-Null

# which atlases are actually referenced by the Orient unit assets
$dir = "$mod\data\config\export\main\asset\assets_includes\units"
$ref = @{}
foreach($f in Get-ChildItem -LiteralPath $dir -Filter *.xml){
    $t=[System.IO.File]::ReadAllText($f.FullName)
    foreach($m in [regex]::Matches($t,'<(?:CfgPath|CfgVariation)>([^<]+)<')){ $ref[$m.Groups[1].Value.ToLower()]=$true }
}
$tex=@{}
foreach($r in $ref.Keys){
    $w = Join-Path $mod ($r -replace '/','\')
    if(-not (Test-Path -LiteralPath $w)){ continue }
    $t=[System.IO.File]::ReadAllText($w)
    foreach($m in [regex]::Matches($t,'<cModelDiffTex>([^<]+)<')){
        $p = $m.Groups[1].Value -replace '\\','/'
        if($p -match '^data/graphics/units/orient/'){ $tex[$p]=$true }
    }
}

$list=@()
foreach($p in ($tex.Keys | Sort-Object)){
    $base   = [System.IO.Path]::GetFileNameWithoutExtension((Join-Path $mod ($p -replace '/','\')))
    $vanRel = $p -replace '^data/graphics/units/orient/','data/dlc06/graphics/units/'
    $vanDir = Split-Path (Join-Path $game ($vanRel -replace '/','\')) -Parent
    $vanTop = Join-Path $vanDir "$base`_0.dds"
    if(-not (Test-Path -LiteralPath $vanTop)){ Write-Output "MISSING vanilla: $base"; continue }

    & C:\Tools\texconv.exe -ft png -y -o $texOut -- $vanTop > $null 2>&1
    $made = Join-Path $texOut "$base`_0.png"
    $want = Join-Path $texOut "$base.png"
    if(Test-Path -LiteralPath $made){ Move-Item -LiteralPath $made -Destination $want -Force }
    if(Test-Path -LiteralPath $want){
        Add-Type -AssemblyName System.Drawing
        $im=New-Object System.Drawing.Bitmap($want)
        $list += [pscustomobject]@{ name=$base; w=$im.Width; h=$im.Height }
        $im.Dispose()
    }
}

# manifest the tool reads so it knows what to load and in what order
$json = "[`r`n" + (($list | ForEach-Object { '  {"name":"' + $_.name + '","w":' + $_.w + ',","h":' + $_.h + '}' }) -join ",`r`n") + "`r`n]"
# build it properly rather than by string surgery
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('[')
for($i=0;$i -lt $list.Count;$i++){
    $c = if($i -lt $list.Count-1){','}else{''}
    [void]$sb.AppendLine(('  {{"name":"{0}","w":{1},"h":{2}}}{3}' -f $list[$i].name,$list[$i].w,$list[$i].h,$c))
}
[void]$sb.AppendLine(']')
[System.IO.File]::WriteAllText((Join-Path $here 'manifest.json'),$sb.ToString(),(New-Object System.Text.UTF8Encoding($false)))

New-Item -ItemType Directory -Force (Join-Path $here 'masks') | Out-Null
Write-Output "exported $($list.Count) textures to $texOut"
$list | Format-Table -AutoSize
