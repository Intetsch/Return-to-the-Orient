"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- nomad s_nomad 1 s_nomad_very_friendly_talk__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- nomad s_nomad 1 s_nomad_angry_idle__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- nomad s_nomad 1 s_nomad_angry_talk__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- nomad s_nomad 1 s_nomad_friendly_idle__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- nomad s_nomad 1 s_nomad_friendly_talk__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- nomad s_nomad 1 s_nomad_neutral_idle__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- nomad s_nomad 1 s_nomad_neutral_stand__0,000-0,017
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- nomad s_nomad 1 s_nomad_neutral_talk__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- nomad s_nomad 1 s_nomad_very_angry_idle__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- nomad s_nomad 1 s_nomad_very_angry_talk__0,000-10,000
"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe" --background --python "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\originals\portrait_importer.py" -- nomad s_nomad 1 s_nomad_very_friendly_idle__0,000-10,000


cd C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb

C:\tools\rdm4-bin.exe -i s_nomad_angry_idle__0,000-10,000.glb -sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform --force -o resident_orient_tier01_angry_idle.rdm
C:\tools\rdm4-bin.exe -i s_nomad_angry_talk__0,000-10,000.glb -sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform --force -o resident_orient_tier01_angry_talk.rdm
C:\tools\rdm4-bin.exe -i s_nomad_friendly_idle__0,000-10,000.glb -sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform --force -o resident_orient_tier01_friendly_idle.rdm
C:\tools\rdm4-bin.exe -i s_nomad_friendly_talk__0,000-10,000.glb -sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform --force -o resident_orient_tier01_friendly_talk.rdm
C:\tools\rdm4-bin.exe -i s_nomad_neutral_idle__0,000-10,000.glb -sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform --force -o resident_orient_tier01_neutral_idle.rdm
C:\tools\rdm4-bin.exe -i s_nomad_neutral_talk__0,000-10,000.glb -sa -g=P4h_N4b_G4b_B4b_T2h_I4b_W4b --no_transform --force -o resident_orient_tier01_neutral_talk.rdm

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb\resident_orient_tier01_angry_idle.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\rdm\resident_orient_tier01.rdm"

del /F /Q "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb\resident_orient_tier01_angry_talk.rdm"
del /F /Q "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb\resident_orient_tier01_friendly_idle.rdm"
del /F /Q "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb\resident_orient_tier01_friendly_talk.rdm"
del /F /Q "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb\resident_orient_tier01_neutral_idle.rdm"
del /F /Q "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb\resident_orient_tier01_neutral_talk.rdm"

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb\resident_orient_tier01_angry_idle_anim_0.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\anim\resident_orient_tier01_angry_idle.rdm"

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb\resident_orient_tier01_angry_talk_anim_0.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\anim\resident_orient_tier01_angry_talk.rdm"

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb\resident_orient_tier01_friendly_idle_anim_0.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\anim\resident_orient_tier01_friendly_idle.rdm"

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb\resident_orient_tier01_friendly_talk_anim_0.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\anim\resident_orient_tier01_friendly_talk.rdm"

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb\resident_orient_tier01_neutral_idle_anim_0.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\anim\resident_orient_tier01_neutral_idle.rdm"

move /Y "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\glb\resident_orient_tier01_neutral_talk_anim_0.rdm" "C:\Users\Max\Documents\Anno 1800\mods\[Addon] Return to the Orient\data\graphics\portraits\orient\resident_orient_tier01\anim\resident_orient_tier01_neutral_talk.rdm"

