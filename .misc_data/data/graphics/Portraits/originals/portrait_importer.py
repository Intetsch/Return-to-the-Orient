import bpy
import sys

# ---------------- ARGUMENTS ----------------
argv = sys.argv

if "--" not in argv:
    raise ValueError("Missing '--' before script arguments")

argv = argv[argv.index("--") + 1:]

if len(argv) != 4:
    raise ValueError("Expected 4 args: portrait_name portraitfile_name tier base_name")

portrait_name, portraitfile_name, tier, base_name = argv

# ---------------- PATHS ----------------
base = "C:/Users/Max/Documents/Anno 1800/mods/[Addon] Return to the Orient/data/graphics/portraits/orient"

cn6_path = f"{base}/originals/{portrait_name}/{portraitfile_name}.cn6"
na2_path = f"{base}/originals/{portrait_name}/{base_name}.na2"
save_path = f"{base}/resident_orient_tier0{tier}/glb/{base_name}.glb"

# ---------------- RESET ----------------
bpy.ops.wm.read_homefile(use_empty=True)

# ---------------- IMPORT ----------------
bpy.ops.import_shape.cn6(filepath=cn6_path)
bpy.ops.import_shape.na2(filepath=na2_path)

# ---------------- EXPORT ----------------
bpy.ops.export_scene.gltf(
    filepath=save_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_tangents=True,
    export_attributes=True,
    export_frame_range=True,
    export_frame_step=1,
    export_force_sampling=True,
    export_animations=True,
    export_anim_single_armature=True,
    export_reset_pose_bones=True,
)

print("Export finished:", save_path)
