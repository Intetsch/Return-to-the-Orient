
@echo off
setlocal enabledelayedexpansion

set "TARGET=C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\.misc_data\data\sessions\islands\pool\orient"
set "SOURCE=C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\.misc_data\data\sessions\islands\pool\original"

rd /s /q "%TARGET%"
mkdir "%TARGET%"
xcopy "%SOURCE%\*" "%TARGET%\" /s /e /y

for /D %%F in ("%TARGET%\*") do (
    set "ISLANDNAME=%%~nxF"
	"C:\tools\RdaConsole.exe" extract -f "%TARGET%\!ISLANDNAME!\!ISLANDNAME!.a7m" -y -o "%TARGET%\!ISLANDNAME!"
	"C:\tools\FileDBReader\FileDBReader.exe" decompress -f "%TARGET%\!ISLANDNAME!\gamedata.data" -c 1 -i "C:\tools\FileDBReader\FileFormats\Island_Gamedata_V2.xml" -y
	"C:\tools\FileDBReader\FileDBReader.exe" decompress -f "%TARGET%\!ISLANDNAME!\rd3d.data" -c 1 -i "C:\tools\FileDBReader\FileFormats\Island_RD3D.xml" -y

    "C:\tools\FileDBReader\FileDBReader.exe" decompress -f "%TARGET%\!ISLANDNAME!\!ISLANDNAME!.a7minfo" -c 1 -i "C:\tools\FileDBReader\FileFormats\a7tinfo.xml" -y
)