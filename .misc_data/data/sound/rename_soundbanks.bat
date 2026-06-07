@echo off
setlocal

set DST=C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\sound\generatedsoundbanks\windows

for %%L in (ru_ru fr_fr en_us de_de) do (
    if not exist "%DST%\%%L" mkdir "%DST%\%%L"
)

set SRC1=C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\sound\wwise\Anno1800_wwise_Project_1nomads\GeneratedSoundBanks\Windows

copy "%SRC1%\ru_ru\Natoncy_Orient_Nomad.json" "%DST%\ru_ru\1318901147.json"
copy "%SRC1%\fr_fr\Natoncy_Orient_Nomad.json" "%DST%\fr_fr\1318901147.json"
copy "%SRC1%\en_us\Natoncy_Orient_Nomad.json" "%DST%\en_us\1318901147.json"
copy "%SRC1%\de_de\Natoncy_Orient_Nomad.json" "%DST%\de_de\1318901147.json"

copy "%SRC1%\ru_ru\Natoncy_Orient_Nomad.xml" "%DST%\ru_ru\1318901147.xml"
copy "%SRC1%\fr_fr\Natoncy_Orient_Nomad.xml" "%DST%\fr_fr\1318901147.xml"
copy "%SRC1%\en_us\Natoncy_Orient_Nomad.xml" "%DST%\en_us\1318901147.xml"
copy "%SRC1%\de_de\Natoncy_Orient_Nomad.xml" "%DST%\de_de\1318901147.xml"

copy "%SRC1%\ru_ru\Natoncy_Orient_Nomad.bnk" "%DST%\ru_ru\1318901147.bnk"
copy "%SRC1%\fr_fr\Natoncy_Orient_Nomad.bnk" "%DST%\fr_fr\1318901147.bnk"
copy "%SRC1%\en_us\Natoncy_Orient_Nomad.bnk" "%DST%\en_us\1318901147.bnk"
copy "%SRC1%\de_de\Natoncy_Orient_Nomad.bnk" "%DST%\de_de\1318901147.bnk"

copy "%SRC1%\ru_ru\Natoncy_Orient_Nomad.txt" "%DST%\ru_ru\1318901147.txt"
copy "%SRC1%\fr_fr\Natoncy_Orient_Nomad.txt" "%DST%\fr_fr\1318901147.txt"
copy "%SRC1%\en_us\Natoncy_Orient_Nomad.txt" "%DST%\en_us\1318901147.txt"
copy "%SRC1%\de_de\Natoncy_Orient_Nomad.txt" "%DST%\de_de\1318901147.txt"


set SRC2=C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\sound\wwise\Anno1800_wwise_Project_2envoys\GeneratedSoundBanks\Windows

copy "%SRC2%\ru_ru\Natoncy_Orient_Envoy.json" "%DST%\ru_ru\291168151.json"
copy "%SRC2%\fr_fr\Natoncy_Orient_Envoy.json" "%DST%\fr_fr\291168151.json"
copy "%SRC2%\en_us\Natoncy_Orient_Envoy.json" "%DST%\en_us\291168151.json"
copy "%SRC2%\de_de\Natoncy_Orient_Envoy.json" "%DST%\de_de\291168151.json"

copy "%SRC2%\ru_ru\Natoncy_Orient_Envoy.xml" "%DST%\ru_ru\291168151.xml"
copy "%SRC2%\fr_fr\Natoncy_Orient_Envoy.xml" "%DST%\fr_fr\291168151.xml"
copy "%SRC2%\en_us\Natoncy_Orient_Envoy.xml" "%DST%\en_us\291168151.xml"
copy "%SRC2%\de_de\Natoncy_Orient_Envoy.xml" "%DST%\de_de\291168151.xml"

copy "%SRC2%\ru_ru\Natoncy_Orient_Envoy.bnk" "%DST%\ru_ru\291168151.bnk"
copy "%SRC2%\fr_fr\Natoncy_Orient_Envoy.bnk" "%DST%\fr_fr\291168151.bnk"
copy "%SRC2%\en_us\Natoncy_Orient_Envoy.bnk" "%DST%\en_us\291168151.bnk"
copy "%SRC2%\de_de\Natoncy_Orient_Envoy.bnk" "%DST%\de_de\291168151.bnk"

copy "%SRC2%\ru_ru\Natoncy_Orient_Envoy.txt" "%DST%\ru_ru\291168151.txt"
copy "%SRC2%\fr_fr\Natoncy_Orient_Envoy.txt" "%DST%\fr_fr\291168151.txt"
copy "%SRC2%\en_us\Natoncy_Orient_Envoy.txt" "%DST%\en_us\291168151.txt"
copy "%SRC2%\de_de\Natoncy_Orient_Envoy.txt" "%DST%\de_de\291168151.txt"

echo.
echo Done.
pause