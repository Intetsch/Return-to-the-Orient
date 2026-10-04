@echo off
setlocal

set "ISLANDNAME=colony02_l_06"

set "TARGET=C:\Users\maxim\Documents\Anno 1800\mods\[Addon] Return to the Orient\.misc_data\data\sessions\islands\pool\orient\%ISLANDNAME%"
set "DEST=C:\Users\maxim\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\sessions\islands\pool\orient\%ISLANDNAME%"

"C:\tools\FileDBReader\FileDBReader.exe" compress -f "%TARGET%\gamedata.xml" -o "data" -c 2 -i "C:\tools\FileDBReader\FileFormats\Island_Gamedata_V2.xml" -y
"C:\tools\FileDBReader\FileDBReader.exe" compress -f "%TARGET%\rd3d.xml" -o "data" -c 2 -i "C:\tools\FileDBReader\FileFormats\Island_RD3D.xml" -y
"C:\tools\RdaConsole.exe" pack -v 2 -f "%TARGET%\gamedata.data" "%TARGET%\rd3d.data" -y -o "%TARGET%\%ISLANDNAME%.a7m"

"C:\tools\FileDBReader\FileDBReader.exe" compress -f "%TARGET%\%ISLANDNAME%.xml" -o "a7minfo" -c 2 -i "C:\tools\FileDBReader\FileFormats\a7tinfo.xml" -y

robocopy "%TARGET%" "%DEST%" *.dds *.ctt *.tmc *.a7m *.png *.a7minfo *.a7me

exit /b 0