"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- envoy embassador_lod0 2 s_citizen_angry_idle__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- envoy embassador_lod0 2 s_citizen_angry_talk__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- envoy embassador_lod0 2 s_citizen_friendly_idle__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- envoy embassador_lod0 2 s_citizen_friendly_talk__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- envoy embassador_lod0 2 s_citizen_neutral_idle__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- envoy embassador_lod0 2 s_citizen_neutral_talk__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- envoy embassador_lod0 2 s_citizen_very_angry_idle__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- envoy embassador_lod0 2 s_citizen_very_angry_talk__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- envoy embassador_lod0 2 s_citizen_very_friendly_idle__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- envoy embassador_lod0 2 s_citizen_very_friendly_talk__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- envoy embassador_lod0 2 s_citizenl_stand__0,000-0,017


cd C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb

C:\tools\rdm4-bin.exe -i s_citizen_angry_idle__0,000-10,000.glb -sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform --force -o resident_orient_tier02_angry_idle.rdm
C:\tools\rdm4-bin.exe -i s_citizen_angry_talk__0,000-10,000.glb -sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform --force -o resident_orient_tier02_angry_talk.rdm
C:\tools\rdm4-bin.exe -i s_citizen_friendly_idle__0,000-10,000.glb -sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform --force -o resident_orient_tier02_friendly_idle.rdm
C:\tools\rdm4-bin.exe -i s_citizen_friendly_talk__0,000-10,000.glb -sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform --force -o resident_orient_tier02_friendly_talk.rdm
C:\tools\rdm4-bin.exe -i s_citizen_neutral_idle__0,000-10,000.glb -sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform --force -o resident_orient_tier02_neutral_idle.rdm
C:\tools\rdm4-bin.exe -i s_citizen_neutral_talk__0,000-10,000.glb -sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform --force -o resident_orient_tier02_neutral_talk.rdm

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb\resident_orient_tier02_angry_idle.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\rdm\resident_orient_tier02.rdm"

del /F /Q "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb\resident_orient_tier02_angry_talk.rdm"
del /F /Q "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb\resident_orient_tier02_friendly_idle.rdm"
del /F /Q "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb\resident_orient_tier02_friendly_talk.rdm"
del /F /Q "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb\resident_orient_tier02_neutral_idle.rdm"
del /F /Q "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb\resident_orient_tier02_neutral_talk.rdm"

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb\resident_orient_tier02_angry_idle_anim_0.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\anim\resident_orient_tier02_angry_idle.rdm"

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb\resident_orient_tier02_angry_talk_anim_0.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\anim\resident_orient_tier02_angry_talk.rdm"

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb\resident_orient_tier02_friendly_idle_anim_0.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\anim\resident_orient_tier02_friendly_idle.rdm"

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb\resident_orient_tier02_friendly_talk_anim_0.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\anim\resident_orient_tier02_friendly_talk.rdm"

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb\resident_orient_tier02_neutral_idle_anim_0.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\anim\resident_orient_tier02_neutral_idle.rdm"

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\glb\resident_orient_tier02_neutral_talk_anim_0.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier02\anim\resident_orient_tier02_neutral_talk.rdm"
