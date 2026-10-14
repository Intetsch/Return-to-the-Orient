// Headless driver for Nexus Buddy 2's own exporters: one 1404 portrait mesh .gr2 -> .cn6,
// and each animation .gr2 -> .na2 sampled against that mesh's skeleton.
// Same calls as the GUI buttons "Export CN6" and "Export NA2" with the GUI defaults (full time window, 60 fps).
// The CN6 writer is a port of CN6FileOps.WriteModelToCN6 (byte-identical output). Sub-meshes without a material
// binding, where the original throws, are left out: in the 1404 portraits they are stray helper objects
// (Lord Northburg's 32-vertex "Bone_Head" box), not something the game drew.
//
// usage: NbDriver.exe <mesh.gr2> [<anim.gr2> ...]
// Outputs land next to the inputs (<mesh>.cn6, <anim>__0.000-10.000.na2), so pass copies.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using Firaxis.Framework.Granny;
using NexusBuddy;
using NexusBuddy.FileOps;
using NexusBuddy.GrannyInfos;
using NexusBuddy.GrannyWrappers;
using NexusBuddy.Utils;

static class NbDriver
{
    [STAThread]
    static int Main(string[] args)
    {
        if (args.Length < 1) { Console.Error.WriteLine("usage: NbDriver <mesh.gr2> [anim.gr2 ...]"); return 2; }
        // The form constructor calls Firaxis' Available.Startup("Civ5"), which scans
        // <HKCU\Software\Firaxis\Tools\ToolAssetPath>\Assets and throws when that folder is missing.
        // By then the form is built and registered in NexusBuddyApplicationForm.form; only the
        // Granny context is left to add, which is all the exporters need.
        NexusBuddyApplicationForm form;
        try
        {
            form = new NexusBuddyApplicationForm();
        }
        catch (IOException e)
        {
            Console.WriteLine("Available.Startup failed (" + e.Message + "), continuing without it");
            form = NexusBuddyApplicationForm.form;
            Firaxis.Framework.Context.Add(new GrannyContext());
        }

        string meshPath = Path.GetFullPath(args[0]);
        IGrannyFile mesh = form.openFileAction(meshPath);
        NexusBuddyApplicationForm.loadedFile = mesh;
        form.refreshAppData();
        IGrannyModel model0 = mesh.Models[0];
        Console.WriteLine("mesh " + meshPath + " models=" + mesh.Models.Count + " bones=" + model0.Skeleton.Bones.Count + " meshes=" + model0.MeshBindings.Count);
        foreach (IGrannyMesh m in model0.MeshBindings)
            Console.WriteLine("  submesh \"" + m.Name + "\" materials=" + m.MaterialBindings.Count + " verts=" + new GrannyMeshWrapper(m).getMeshInfo().vertices.Count);

        for (int i = 0; i < mesh.Models.Count; i++)
        {
            List<string> decals = WriteModelToCN6(mesh, mesh.Models[i], null);
            foreach (string d in decals) WriteModelToCN6(mesh, mesh.Models[i], d);
        }

        int failures = 0;
        for (int i = 1; i < args.Length; i++)
        {
            string animPath = Path.GetFullPath(args[i]);
            IGrannyFile anim = form.openFileAsTempFileCopy(animPath, "tempanimopen");
            if (anim.Animations.Count != 1)
            {
                Console.WriteLine("SKIP " + animPath + " animations=" + anim.Animations.Count);
                failures++;
                continue;
            }
            int retries = NB2Exporter.exportNA2(model0, anim.Animations[0], animPath, -1, -1, 60, 5);
            Console.WriteLine("anim " + Path.GetFileName(animPath) + " duration=" + anim.Animations[0].Duration + " step=" + anim.Animations[0].TimeStep + " retries=" + retries);
            if (retries >= 5) failures++;
        }
        return failures == 0 ? 0 : 1;
    }

    static string F(float f) { return f.ToString("f8", CultureInfo.InvariantCulture); }

    static string MaterialName(IGrannyMaterial material)
    {
        IndieMaterial shader = NexusBuddyApplicationForm.GetIndieMaterialFromMaterial(material);
        string baseMap;
        if (shader.GetType().Name == "IndieLeaderGlassShader") baseMap = "Leader_cornea";
        else if (shader.GetType().Name == "IndieBuildingShader") baseMap = shader.Diffuse;
        else if (shader.GetType().Name.StartsWith("IndieLeaderFur")) baseMap = shader.Fur_BaseMap;
        else if (shader.GetType().Name.StartsWith("IndieLeader")) baseMap = shader.DiffuseMap;
        else baseMap = shader.BaseTextureMap;
        return !String.IsNullOrEmpty(baseMap) ? baseMap : material.Name;
    }

    // Port of CN6FileOps.WriteModelToCN6 (Nexus Buddy 2.5.4); returns the flat ("decal") mesh names.
    static List<string> WriteModelToCN6(IGrannyFile grannyFile, IGrannyModel model, string filterMeshName)
    {
        List<string> decalMeshNames = new List<string>();
        IGrannySkeleton skeleton = model.Skeleton;
        string decalMeshName = filterMeshName != null ? "_DCL_" + CN6Safe(filterMeshName) : "";
        string outputFilename;
        if (grannyFile.Models.Count > 1)
        {
            string modelFilename = "__" + model.Name + decalMeshName + ".cn6";
            outputFilename = grannyFile.Filename.Replace(".gr2", modelFilename).Replace(".GR2", modelFilename);
        }
        else
        {
            outputFilename = grannyFile.Filename.Replace(".gr2", ".cn6").Replace(".GR2", ".cn6");
        }
        outputFilename = Path.GetDirectoryName(outputFilename) + "\\" + CN6Safe(Path.GetFileName(outputFilename));

        List<GrannyMeshInfo> infos = new List<GrannyMeshInfo>();
        HashSet<string> distinctMeshNames = new HashSet<string>();
        for (int i = 0; i < model.MeshBindings.Count; i++)
        {
            infos.Add(new GrannyMeshWrapper(model.MeshBindings[i]).getMeshInfo());
            distinctMeshNames.Add(model.MeshBindings[i].Name);
        }
        Dictionary<string, int> meshNameCount = new Dictionary<string, int>();
        foreach (string n in distinctMeshNames) meshNameCount.Add(n, 0);

        BiLookup<int, string> boneLookup = new BiLookup<int, string>();
        for (int i = 0; i < skeleton.Bones.Count; i++) boneLookup.Add(i, skeleton.Bones[i].Name);
        Dictionary<string, double[]> bonePos = new Dictionary<string, double[]>();
        foreach (IGrannyBone bone in skeleton.Bones)
            if (!bonePos.ContainsKey(bone.Name)) bonePos.Add(bone.Name, NB2Exporter.getBoneWorldPosition(bone));

        int meshCount = 0;
        for (int mi = 0; mi < infos.Count; mi++)
        {
            bool flat = true;
            foreach (GrannyVertexInfo v in infos[mi].vertices)
                if (!NumberUtils.almostEquals(v.position[2], 0.0f, 4)) { flat = false; break; }
            if (model.MeshBindings[mi].MaterialBindings.Count == 0) continue;
            if (filterMeshName == null) { if (flat) decalMeshNames.Add(model.MeshBindings[mi].Name); else meshCount++; }
            else meshCount = 1;
        }
        if (meshCount == 0) return decalMeshNames;

        StringBuilder sb = new StringBuilder();
        sb.Append("// CivNexus6 CN6 - Exported from Nexus Buddy " + NexusBuddyApplicationForm.getVersionString() + "\r\n");
        sb.Append("skeleton\r\n");
        for (int bi = 0; bi < skeleton.Bones.Count; bi++)
        {
            IGrannyBone bone = skeleton.Bones[bi];
            float[] o = bone.LocalTransform.Orientation, p = bone.LocalTransform.Position;
            StringBuilder line = new StringBuilder(bi + " \"" + bone.Name + "\" " + bone.ParentIndex + " " + F(p[0]) + " " + F(p[1]) + " " + F(p[2]) + " " + F(o[0]) + " " + F(o[1]) + " " + F(o[2]) + " " + F(o[3]));
            foreach (float j in bone.InverseWorldTransform) line.Append(" " + F(j));
            sb.Append(line).Append("\r\n");
        }
        sb.Append("meshes:" + meshCount + "\r\n");
        for (int mi = 0; mi < infos.Count; mi++)
        {
            GrannyMeshInfo info = infos[mi];
            string meshName = model.MeshBindings[mi].Name;
            if (model.MeshBindings[mi].MaterialBindings.Count == 0) { Console.WriteLine("  submesh \"" + meshName + "\" has no material, left out"); continue; }
            if (!((filterMeshName == null && !decalMeshNames.Contains(meshName)) || meshName.Equals(filterMeshName))) continue;
            meshNameCount[meshName]++;
            if (meshNameCount[meshName] > 1) meshName += meshNameCount[meshName];
            sb.Append("mesh:\"" + meshName + "\"\r\n");
            sb.Append("materials\r\n");
            var mats = model.MeshBindings[mi].MaterialBindings;
            foreach (IGrannyMaterial material in mats) sb.Append("\"" + MaterialName(material) + "\"\r\n");
            sb.Append("vertices\r\n");
            foreach (GrannyVertexInfo v in info.vertices)
            {
                int[] ids = new int[4];
                for (int z = 0; z < 4; z++)
                    ids[z] = NB2Exporter.getBoneIdForBoneName(boneLookup, bonePos, info.boneBindings[v.boneIndices[z]], (float)v.boneWeights[z] / 255, v.position);
                float[] t = v.tangent ?? v.normal, b = v.binormal ?? v.normal;
                sb.Append(F(v.position[0]) + " " + F(v.position[1]) + " " + F(v.position[2]) + " " +
                          F(v.normal[0]) + " " + F(v.normal[1]) + " " + F(v.normal[2]) + " " +
                          F(t[0]) + " " + F(t[1]) + " " + F(t[2]) + " " +
                          F(b[0]) + " " + F(b[1]) + " " + F(b[2]) + " " +
                          F(v.uv[0]) + " " + F(v.uv[1]) + " " + F(0f) + " " + F(0f) + " " + F(0f) + " " + F(0f) + " " +
                          ids[0] + " " + ids[1] + " " + ids[2] + " " + ids[3] + " 0 0 0 0 " +
                          v.boneWeights[0] + " " + v.boneWeights[1] + " " + v.boneWeights[2] + " " + v.boneWeights[3] + " 0 0 0 0 \r\n");
            }
            sb.Append("triangles\r\n");
            foreach (int[] tri in info.triangles) sb.Append(tri[0] + " " + tri[1] + " " + tri[2] + " 0\r\n");
        }
        sb.Append("end\r\n");
        File.WriteAllText(outputFilename, sb.ToString(), new UTF8Encoding(false));
        return decalMeshNames;
    }

    static string CN6Safe(string filename)
    {
        return string.Join("_", filename.Split(Path.GetInvalidFileNameChars())).Replace(" ", "_");
    }
}
