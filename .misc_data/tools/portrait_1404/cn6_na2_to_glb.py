# Blender 3.5 (background): import a Nexus Buddy .cn6 mesh plus one .na2 animation and export a .glb.
# Same steps and glTF options as .misc_data/data/graphics/Portraits/originals/portrait_importer.py,
# with explicit paths instead of the hardcoded folder layout.
#
# blender.exe --background --python cn6_na2_to_glb.py -- <mesh.cn6> <anim.na2> <out.glb>
import bpy
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
if len(argv) != 3:
    raise ValueError("Expected 3 args: mesh.cn6 anim.na2 out.glb")
cn6_path, na2_path, save_path = argv

bpy.ops.wm.read_homefile(use_empty=True)

bpy.ops.import_shape.cn6(filepath=cn6_path)
bpy.ops.import_shape.na2(filepath=na2_path)

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
