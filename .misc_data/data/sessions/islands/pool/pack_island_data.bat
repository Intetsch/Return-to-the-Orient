
@echo off
setlocal enabledelayedexpansion

set "TARGET=C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\.misc_data\data\sessions\islands\pool\orient"
set "DEST=C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\sessions\islands\pool\orient"

for /D %%F in ("%TARGET%\*") do (
    set "ISLANDNAME=%%~nxF"

    "C:\tools\FileDBReader\FileDBReader.exe" compress -f "%TARGET%\!ISLANDNAME!\gamedata.xml" -o "data" -c 2 -i "C:\tools\FileDBReader\FileFormats\Island_Gamedata_V2.xml" -y
    "C:\tools\FileDBReader\FileDBReader.exe" compress -f "%TARGET%\!ISLANDNAME!\rd3d.xml" -o "data" -c 2 -i "C:\tools\FileDBReader\FileFormats\Island_RD3D.xml" -y
    "C:\tools\RdaConsole.exe" pack -v 2 -f "%TARGET%\!ISLANDNAME!\gamedata.data" "%TARGET%\!ISLANDNAME!\rd3d.data" -y -o "%TARGET%\!ISLANDNAME!\!ISLANDNAME!.a7m"

    "C:\tools\FileDBReader\FileDBReader.exe" compress -f "%TARGET%\!ISLANDNAME!\!ISLANDNAME!.xml" -o "a7minfo" -c 2 -i "C:\tools\FileDBReader\FileFormats\a7tinfo.xml" -y
)

rem Copy files while preserving directory structure
robocopy "%TARGET%" "%DEST%" *.dds *.ctt *.tmc *.a7m *.png *.a7minfo *.a7me /S

exit /b 0