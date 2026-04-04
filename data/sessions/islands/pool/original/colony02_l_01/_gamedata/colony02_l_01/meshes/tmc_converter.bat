@ECHO off

FOR /R %%i IN (*.tmc) DO (
    START /W /B C:\tools\FileDBReader\FileDBReader.exe decompress -f "%%i" -i "../tmc.xml" -y
)

FOR /R %%i IN (*.xml) DO (
    ECHO ^<ModOps^> > "%%i_patch.xml" 
    ECHO ^<ModOp Type^=^"replace^" Path=^"^/^/GroundObjects^/None^/FileName^[text^(^) ^= ^'data^\graphics^\props^\terrain^_props^\vegetation^\grass^\flowers^_moderate^_01^.prp^'^]^"^> >> "%%i_patch.xml" 
    ECHO ^<FileName^>data^\graphics^\props^\terrain_props^\vegetation^\grass^\flowers^_jungle^_01^.prp^<^/FileName^> >> "%%i_patch.xml"    
    ECHO ^<^/ModOp^> >> "%%i_patch.xml"
    ECHO ^<ModOp Type^=^"replace^" Path=^"^/^/GroundObjects^/None^/FileName^[text^(^) ^= ^'data^\graphics^\props^\terrain^_props^\vegetation^\grass^\flowers^_moderate^_02^.prp^'^]^"^> >> "%%i_patch.xml" 
    ECHO ^<FileName^>data^\graphics^\props^\terrain_props^\vegetation^\grass^\flowers^_jungle^_02^.prp^<^/FileName^> >> "%%i_patch.xml"     
    ECHO ^<^/ModOp^> >> "%%i_patch.xml"
    ECHO ^<ModOp Type^=^"replace^" Path=^"^/^/GroundObjects^/None^/FileName^[text^(^) ^= ^'data^\graphics^\props^\terrain^_props^\vegetation^\grass^\flowers^_moderate^_03^.prp^'^]^"^> >> "%%i_patch.xml" 
    ECHO ^<FileName^>data^\graphics^\props^\terrain_props^\vegetation^\grass^\flowers^_jungle^_03^.prp^<^/FileName^> >> "%%i_patch.xml"     
    ECHO ^<^/ModOp^> >> "%%i_patch.xml"
    ECHO ^<ModOp Type^=^"replace^" Path=^"^/^/GroundObjects^/None^/FileName^[text^(^) ^= ^'data^\graphics^\props^\terrain^_props^\vegetation^\grass^\flowers^_moderate^_04^.prp^'^]^"^> >> "%%i_patch.xml" 
    ECHO ^<FileName^>data^\graphics^\props^\terrain_props^\vegetation^\grass^\flowers^_jungle^_04^.prp^<^/FileName^> >> "%%i_patch.xml"     
    ECHO ^<^/ModOp^> >> "%%i_patch.xml"
    ECHO ^<ModOp Type^=^"replace^" Path=^"^/^/GroundObjects^/None^/FileName^[text^(^) ^= ^'data^\graphics^\props^\terrain^_props^\vegetation^\grass^\flowers^_moderate^_05^.prp^'^]^"^> >> "%%i_patch.xml" 
    ECHO ^<FileName^>data^\graphics^\props^\terrain_props^\vegetation^\grass^\flowers^_jungle^_01^.prp^<^/FileName^> >> "%%i_patch.xml"   
    ECHO ^<^/ModOp^> >> "%%i_patch.xml"     
    ECHO ^<^/ModOps^> >> "%%i_patch.xml"
)  


[text() = 'hello']