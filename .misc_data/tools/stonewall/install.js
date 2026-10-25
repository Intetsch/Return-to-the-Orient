// Installs one wall size into the mod: data/graphics/buildings/orient/<dir>/ (variants.js: stonewall, stonewall_large)
//   maps/<prefix>_{diff,norm,metal}.png + _0.._2.dds (box halvings, BC7 -sepalpha full mips, like the source maps)
//   small only: maps/stonewall_ground_<shape>_diff_0.png + _0.._4.dds (grass-free canal grounds from ground.js, 5 levels
//   like the canal's); both sizes use them
//   rdm/<prefix>_<piece>_lod0.rdm, <prefix>_<piece>.cfg/.ifo (CRLF, no comments)
// node install.js <texDir> <meshDir> <groundDir> [small|large] [modRoot, default ../../..]
// As a module (install_junction.js): the cfg/ifo/material writers below.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { decode, encode } = require('../ornament_icons/png.js');
const VARIANTS = require('./variants.js');
const { TH, E, GROUND_REL } = VARIANTS;
const TMP = path.join(__dirname, 'tmp_dds');
const CRLF = s => s.replace(/\r?\n/g, '\r\n');

// ---- textures ----
function halve(im) {
  const w = im.w >> 1, h = im.h >> 1, px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
    let s = 0; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s += im.px[((2 * y + dy) * im.w + 2 * x + dx) * 4 + c];
    px[(y * w + x) * 4 + c] = (s + 2) >> 2;
  }
  return { w, h, ch: 4, px };
}
// copy only when the bytes differ: other programs (previewers, scanners) keep freshly written DDS files mapped for a
// while, and Windows then refuses to overwrite them even with the same content
function update(src, dst) {
  if (fs.existsSync(dst) && fs.readFileSync(dst).equals(fs.readFileSync(src))) return;
  try { fs.copyFileSync(src, dst); }
  catch (e) { throw new Error(`cannot write ${dst} (open in another program?): ${e.message}`); }
}
// <src>.png -> <name>.png (or _0.png) + _0.._<levels-1>.dds in <dir>; encoded in TMP first
function writeLevels(src, dir, name, levels, pngName) {
  update(src, path.join(dir, pngName));
  let im = decode(src);
  for (let k = 0; k < levels; k++) {
    if (k) im = halve(im);
    const p = path.join(TMP, `${name}_${k}.png`);
    encode(p, im.w, im.h, 4, im.px);
    try { execFileSync('C:/tools/texconv.exe', ['-nologo', '-y', '-sepalpha', '-f', 'BC7_UNORM', '-m', '0', '-o', TMP, p], { stdio: 'pipe' }); }
    catch (e) { throw new Error(`texconv ${name}_${k}: ${String(e.stdout).trim()}`); }
    update(path.join(TMP, `${name}_${k}.dds`), path.join(dir, `${name}_${k}.dds`));
  }
}
function writeTextures(DST, PRE, texDir, groundDir, withGround) {
  for (const n of ['diff', 'norm', 'metal']) writeLevels(path.join(texDir, `${PRE}_${n}.png`), path.join(DST, 'maps'), `${PRE}_${n}`, 3, `${PRE}_${n}.png`);
  if (withGround) for (const s of ['straight', 'end', 'curve', '3way', 'cross', 'single']) {
    const base = `stonewall_ground_${s}_diff`;
    writeLevels(path.join(groundDir, base + '_0.png'), path.join(DST, 'maps'), base, 5, base + '_0.png');
  }
}

// ---- pieces: arms for the hit boxes ([x0,x1,z0,z1]) ----
const PIECES = {
  mid: [[-0.5, 0.5, -TH, TH]],
  end: [[-0.5, E, -TH, TH]],
  corner: [[-TH, 0.5, -TH, TH], [-TH, TH, -0.5, -TH]],
  x: [[-0.5, 0.5, -TH, TH], [-TH, TH, -0.5, -TH], [-TH, TH, TH, 0.5]],
  t: [[-0.5, 0.5, -TH, TH], [-TH, TH, -0.5, -TH]],
  single: [[-E, E, -TH, TH]],
};
// FeedbackBlockers as in the vanilla wall systems (park fence 102093, CDLC09 walls): everything except a half-tile
// corridor along the arms, closed at a free end, so walkers cannot cross the line
const STRIPS = [[[0.5, 0.5], [0.5, 0.25], [-0.5, 0.25], [-0.5, 0.5]], [[0.5, -0.5], [0.5, -0.25], [-0.5, -0.25], [-0.5, -0.5]]];
const END_PX = [[0.5, 0.25], [0.5, -0.25], [0.25, -0.25], [0.25, 0.25]], END_MX = [[-0.25, 0.25], [-0.25, -0.25], [-0.5, -0.25], [-0.5, 0.25]];
const CORNER = (sx, sz) => [[sx * 0.5, sz * 0.5], [sx * 0.5, sz * 0.25], [sx * 0.25, sz * 0.25], [sx * 0.25, sz * 0.5]];
const FEEDBACK = {
  mid: STRIPS,
  end: [...STRIPS, END_PX],
  corner: [[[0.5, 0.5], [0.5, 0.25], [-0.25, 0.25], [-0.25, -0.5], [-0.5, -0.5], [-0.5, 0.25], [-0.5, 0.5]], CORNER(1, -1)],
  x: [CORNER(1, 1), CORNER(1, -1), CORNER(-1, -1), CORNER(-1, 1)],
  t: [STRIPS[0], CORNER(1, -1), CORNER(-1, -1)],
  single: [...STRIPS, END_PX, END_MX],
};
const f = v => +v.toFixed(4) + '';
// the ground decal covers the whole tile, the wall only its arms
function bounds(H) {
  const mn = [-0.5, 0, -0.5], mx = [0.5, H, 0.5];
  const mar = [0.05, 0.1, 0.05];
  const c = mn.map((v, k) => (v + mx[k]) / 2), e = mn.map((v, k) => (mx[k] - v) / 2 + mar[k]);
  return { c, e, r: Math.hypot(...e) };
}
const material = (REL, PRE) => `				<Config>
					<ConfigType>MATERIAL</ConfigType>
					<VertexFormat>P4h_N4b_G4b_B4b_T2h</VertexFormat>
					<Common>Common</Common>
					<TerrainAdaption>TerrainAdaption</TerrainAdaption>
					<Environment>Environment</Environment>
					<WindRipples />
					<ShaderID>8</ShaderID>
					<NumBonesPerVertex>0</NumBonesPerVertex>
					<PARALLAX_MAPPING_ENABLED>1</PARALLAX_MAPPING_ENABLED>
					<VERTEX_COLORED_TERRAIN_ADAPTION>0</VERTEX_COLORED_TERRAIN_ADAPTION>
					<ABSOLUTE_TERRAIN_ADAPTION>0</ABSOLUTE_TERRAIN_ADAPTION>
					<cUseLocalEnvironmentBox>1</cUseLocalEnvironmentBox>
					<WIND_RIPPLES_ENABLED>0</WIND_RIPPLES_ENABLED>
					<DisableReviveDistance>0</DisableReviveDistance>
					<cTexScrollSpeed>0.000000</cTexScrollSpeed>
					<cParallaxScale>1.000000</cParallaxScale>
					<cEnvironmentBoundingBox.x>0.000000</cEnvironmentBoundingBox.x>
					<cEnvironmentBoundingBox.y>0.000000</cEnvironmentBoundingBox.y>
					<cEnvironmentBoundingBox.z>0.000000</cEnvironmentBoundingBox.z>
					<cEnvironmentBoundingBox.w>4.000000</cEnvironmentBoundingBox.w>
					<cWindRippleTex>data/graphics/effects/cloth/clothripple01_1404.psd</cWindRippleTex>
					<cWindRippleTiling>0.208000</cWindRippleTiling>
					<cWindRippleSpeed>1.063000</cWindRippleSpeed>
					<cWindRippleNormalIntensity>2.200000</cWindRippleNormalIntensity>
					<cWindRippleMeshIntensity>0.250000</cWindRippleMeshIntensity>
					<cUseTerrainTinting>0</cUseTerrainTinting>
					<SEPARATE_AO_TEXTURE>0</SEPARATE_AO_TEXTURE>
					<SELF_SHADOWING_ENABLED>1</SELF_SHADOWING_ENABLED>
					<WATER_CUTOUT_ENABLED>0</WATER_CUTOUT_ENABLED>
					<ADJUST_TO_TERRAIN_HEIGHT>1</ADJUST_TO_TERRAIN_HEIGHT>
					<Glow></Glow>
					<GLOW_ENABLED>0</GLOW_ENABLED>
					<Name>building_material</Name>
					<DIFFUSE_ENABLED>1</DIFFUSE_ENABLED>
					<cModelDiffTex>${REL}/maps/${PRE}_diff.png</cModelDiffTex>
					<NORMAL_ENABLED>1</NORMAL_ENABLED>
					<cModelNormalTex>${REL}/maps/${PRE}_norm.png</cModelNormalTex>
					<METALLIC_TEX_ENABLED>1</METALLIC_TEX_ENABLED>
					<cModelMetallicTex>${REL}/maps/${PRE}_metal.png</cModelMetallicTex>
					<NIGHT_GLOW_ENABLED>0</NIGHT_GLOW_ENABLED>
					<cNightGlowMap></cNightGlowMap>
					<DYE_MASK_ENABLED>0</DYE_MASK_ENABLED>
					<cDyeMask></cDyeMask>
					<HEIGHT_MAP_ENABLED>0</HEIGHT_MAP_ENABLED>
					<cHeightMap></cHeightMap>
					<SEPARATE_AO_TEXTURE>0</SEPARATE_AO_TEXTURE>
					<cDiffuseColor.r>0.75</cDiffuseColor.r>
					<cDiffuseColor.g>0.75</cDiffuseColor.g>
					<cDiffuseColor.b>0.75</cDiffuseColor.b>
					<cAlphaRef>0.100000</cAlphaRef>
					<cEmissiveColor.r>0.8</cEmissiveColor.r>
					<cEmissiveColor.g>0.8</cEmissiveColor.g>
					<cEmissiveColor.b>0.8</cEmissiveColor.b>
				</Config>`;
// ground: the Orient canal's bank decals with the grass removed (ground.js), one per shape like the canal pieces,
// same material as the canal.
// Their open (opaque) edges, with u along +x and v along -z: straight -x/+x, end +x, curve +x/-z, 3way -x/+x/-z, cross all,
// single none; so only the end is turned (180 deg) to the wall end's -x arm.
const GROUND = { mid: ['straight', 0], end: ['end', 180], corner: ['curve', 0], x: ['cross', 0], t: ['3way', 0], single: ['single', 0] };
const decal = name => {
  const [tex, deg] = GROUND[name], q = [Math.sin(deg * Math.PI / 360), Math.cos(deg * Math.PI / 360)].map(v => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(6));
  return `		<Config>
			<ConfigType>DECAL</ConfigType>
			<Transformer>
				<Config>
					<ConfigType>ORIENTATION_TRANSFORM</ConfigType>
					<Conditions>0</Conditions>
					<Position.x>0.000000</Position.x>
					<Position.y>0.000000</Position.y>
					<Position.z>0.000000</Position.z>
					<Rotation.x>0.000000</Rotation.x>
					<Rotation.y>${q[0]}</Rotation.y>
					<Rotation.z>0.000000</Rotation.z>
					<Rotation.w>${q[1]}</Rotation.w>
					<Scale>1.000000</Scale>
				</Config>
			</Transformer>
			<Materials>
				<Config>
					<ConfigType>MATERIAL</ConfigType>
					<Name></Name>
					<ShaderID>1</ShaderID>
					<VertexFormat>P3f_N3f_G3f_T2f_T1f_T1f_T1f</VertexFormat>
					<NumBonesPerVertex>0</NumBonesPerVertex>
					<METALLIC_TEX_ENABLED>0</METALLIC_TEX_ENABLED>
					<cModelMetallicTex>data/graphics/effects/default_model_mask.png</cModelMetallicTex>
					<cUseTerrainTinting>0</cUseTerrainTinting>
					<Common>Common</Common>
					<DIFFUSE_ENABLED>1</DIFFUSE_ENABLED>
					<cModelDiffTex>${GROUND_REL}/maps/stonewall_ground_${tex}_diff.psd</cModelDiffTex>
					<NORMAL_ENABLED>1</NORMAL_ENABLED>
					<cModelNormalTex>data/dlc06/graphics/effects/street/irrigation_system_01/maps/canal_system_ground_straight_01_norm.psd</cModelNormalTex>
					<cDiffuseColor.r>1.000000</cDiffuseColor.r>
					<cDiffuseColor.g>1.000000</cDiffuseColor.g>
					<cDiffuseColor.b>1.000000</cDiffuseColor.b>
					<cGlossinessFactor>1.000000</cGlossinessFactor>
					<cOpacity>1.000000</cOpacity>
					<HEIGHT_MAP_ENABLED>0</HEIGHT_MAP_ENABLED>
					<cHeightMap>data/graphics/effects/default_height.png</cHeightMap>
					<cParallaxScale>1.000000</cParallaxScale>
					<PARALLAX_MAPPING_ENABLED>1</PARALLAX_MAPPING_ENABLED>
					<SELF_SHADOWING_ENABLED>0</SELF_SHADOWING_ENABLED>
					<TerrainAdaption>TerrainAdaption</TerrainAdaption>
					<ADJUST_TO_TERRAIN_HEIGHT>0</ADJUST_TO_TERRAIN_HEIGHT>
					<VERTEX_COLORED_TERRAIN_ADAPTION>0</VERTEX_COLORED_TERRAIN_ADAPTION>
					<ABSOLUTE_TERRAIN_ADAPTION>0</ABSOLUTE_TERRAIN_ADAPTION>
					<Environment>Environment</Environment>
					<cUseLocalEnvironmentBox>1</cUseLocalEnvironmentBox>
					<cEnvironmentBoundingBox.x>0.000000</cEnvironmentBoundingBox.x>
					<cEnvironmentBoundingBox.y>0.000000</cEnvironmentBoundingBox.y>
					<cEnvironmentBoundingBox.z>0.000000</cEnvironmentBoundingBox.z>
					<cEnvironmentBoundingBox.w>4.000000</cEnvironmentBoundingBox.w>
					<Glow>Glow</Glow>
					<GLOW_ENABLED>1</GLOW_ENABLED>
					<cEmissiveColor.r>2.000000</cEmissiveColor.r>
					<cEmissiveColor.g>2.000000</cEmissiveColor.g>
					<cEmissiveColor.b>2.000000</cEmissiveColor.b>
					<DisableReviveDistance>0</DisableReviveDistance>
				</Config>
			</Materials>
			<Type>Terrain</Type>
			<Name></Name>
			<Extents.x>0.500000</Extents.x>
			<Extents.y>0.250000</Extents.y>
			<Extents.z>0.500000</Extents.z>
			<TexCoords.x>0.000000</TexCoords.x>
			<TexCoords.y>0.000000</TexCoords.y>
			<TexCoords.z>1.000000</TexCoords.z>
			<TexCoords.w>1.000000</TexCoords.w>
			<OnStreets>1</OnStreets>
			<FadeDuration>1000</FadeDuration>
			<HasDetails>0</HasDetails>
			<DetailMeshEmpty>1</DetailMeshEmpty>
			<DetailColorKey>
				<x>0.467000</x>
				<y>0.557000</y>
				<z>0.137000</z>
			</DetailColorKey>
			<DetailColorTolerance>
				<x>0.100000</x>
				<y>0.300000</y>
				<z>0.400000</z>
			</DetailColorTolerance>
			<DetailAlphaRef>0.800000</DetailAlphaRef>
			<DetailDensity>1.600000</DetailDensity>
			<DetailScaleRange>
				<x>0.500000</x>
				<y>0.700000</y>
			</DetailScaleRange>
			<DetailTemplateFileName>data/graphics/props/terrain_props/vegetation/grass/decal_grass_single_01.prp</DetailTemplateFileName>
		</Config>`;
};
// models: [{ file, material }]; key: the piece whose ground decal it gets
const cfg = (models, key, b) => `
<Config>
	<ConfigType>MAIN</ConfigType>
	<RenderPropertyFlags>134414464</RenderPropertyFlags>
	<SimplygonFlags>0</SimplygonFlags>
	<Center.x>${f(b.c[0])}</Center.x>
	<Center.y>${f(b.c[1])}</Center.y>
	<Center.z>${f(b.c[2])}</Center.z>
	<Extent.x>${f(b.e[0])}</Extent.x>
	<Extent.y>${f(b.e[1])}</Extent.y>
	<Extent.z>${f(b.e[2])}</Extent.z>
	<Radius>${f(b.r)}</Radius>
	<Mass>1.000000</Mass>
	<Drag>1.000000</Drag>
	<MeshCenter.x>${f(b.c[0])}</MeshCenter.x>
	<MeshCenter.y>${f(b.c[1])}</MeshCenter.y>
	<MeshCenter.z>${f(b.c[2])}</MeshCenter.z>
	<MeshExtent.x>${f(b.e[0])}</MeshExtent.x>
	<MeshExtent.y>${f(b.e[1])}</MeshExtent.y>
	<MeshExtent.z>${f(b.e[2])}</MeshExtent.z>
	<MeshRadius>${f(b.r)}</MeshRadius>
	<Sequences>
	</Sequences>

	<Decals>
${decal(key)}
	</Decals>

	<Files>

	</Files>
	<Models>

${models.map(m => `		<Config>
			<ConfigType>MODEL</ConfigType>
			<IgnoreRuinState>0</IgnoreRuinState>
			<FileName>${m.file}</FileName>
			<MaterialLODInfos>
				<i>
					<Indices>
						<i>0</i>
					</Indices>
				</i>
				<i>
					<Indices></Indices>
				</i>
				<i>
					<Indices></Indices>
				</i>
				<i>
					<Indices></Indices>
				</i>
				<i>
					<Indices></Indices>
				</i>
			</MaterialLODInfos>
			<Name></Name>
			<Transformer>
				<Config>
					<ConfigType>ORIENTATION_TRANSFORM</ConfigType>
					<Position.x>0</Position.x>
					<Position.y>0</Position.y>
					<Position.z>0</Position.z>
					<Rotation.x>0</Rotation.x>
					<Rotation.y>0</Rotation.y>
					<Rotation.z>0</Rotation.z>
					<Rotation.w>1</Rotation.w>
					<Scale>1</Scale>
				</Config>
			</Transformer>
			<Materials>

${m.material}

			</Materials>
		</Config>`).join('\n\n')}

	</Models>
	<PropContainers>
		<Config>
			<ConfigType>PROPCONTAINER</ConfigType>
			<VariationEnabled>0</VariationEnabled>
			<VariationProbability>100</VariationProbability>
			<AllowYScale>0</AllowYScale>
			<AdaptTerrainHeight>0</AdaptTerrainHeight>
			<Transformer>
				<Config>
					<ConfigType>ORIENTATION_TRANSFORM</ConfigType>
					<Conditions>0</Conditions>
					<Scale>1</Scale>
					<Position.x>0</Position.x>
					<Position.y>0</Position.y>
					<Position.z>0</Position.z>
					<Rotation.x>0</Rotation.x>
					<Rotation.y>0</Rotation.y>
					<Rotation.z>0</Rotation.z>
					<Rotation.w>1</Rotation.w>
					<Scale.x>1</Scale.x>
					<Scale.y>1</Scale.y>
					<Scale.z>1</Scale.z>
				</Config>
			</Transformer>
			<Name />
		</Config>
	</PropContainers>
	<Clothes>

	</Clothes>
	<Particles>

	</Particles>
	<Collisions>

	</Collisions>
</Config>
`;
const box = (tag, name, c, e) => `  <${tag}>
    <Name>${name}</Name>
    <Position>
      <xf>${f(c[0])}</xf>
      <yf>${f(c[1])}</yf>
      <zf>${f(c[2])}</zf>
    </Position>
    <Rotation>
      <xf>0</xf>
      <yf>0</yf>
      <zf>0</zf>
      <wf>1</wf>
    </Rotation>
    <Extents>
      <xf>${f(e[0])}</xf>
      <yf>${f(e[1])}</yf>
      <zf>${f(e[2])}</zf>
    </Extents>
  </${tag}>
`;
const polygon = (tag, pts) => `  <${tag}>
${pts.map(([x, z]) => `    <Position>
      <xf>${x}</xf>
      <zf>${z}</zf>
    </Position>
`).join('')}  </${tag}>
`;
// hit boxes: each arm, a little thicker than the wall so it is easy to pick
const PICK = 0.08;
const ifo = (arms, feedback, b, H) => `<Info>
${box('BoundingBox', 'BoundingBox', b.c, b.e)}${box('MeshBoundingBox', 'MeshBoundingBox', b.c, b.e)}  <DisableFeedbackArea>0</DisableFeedbackArea>
${arms.map(([x0, x1, z0, z1], i) => {
  const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
  return box('IntersectBox', `Hitbox_${i}`, [(x0 + x1) / 2, H / 2, (z0 + z1) / 2], [Math.max(hx, PICK), H / 2 + 0.02, Math.max(hz, PICK)]);
}).join('')}${polygon('BuildBlocker', [[0.5, 0.5], [0.5, -0.5], [-0.5, -0.5], [-0.5, 0.5]])}${feedback.map(p => polygon('FeedbackBlocker', p)).join('')}</Info>
`;
module.exports = { PIECES, FEEDBACK, material, cfg, ifo, bounds, CRLF, writeLevels, TMP };
if (require.main === module) {
  const [texDir, meshDir, groundDir, variant = 'small', MOD = path.resolve(__dirname, '../../..')] = process.argv.slice(2);
  const V = VARIANTS[variant], H = V.H, PRE = V.prefix, REL = `data/graphics/buildings/orient/${V.dir}`, DST = path.join(MOD, REL);
  for (const d of [DST, path.join(DST, 'maps'), path.join(DST, 'rdm'), TMP]) fs.mkdirSync(d, { recursive: true });
  writeTextures(DST, PRE, texDir, groundDir, variant === 'small');
  for (const [name, arms] of Object.entries(PIECES)) {
    fs.copyFileSync(path.join(meshDir, name, `${PRE}_${name}_lod0.rdm`), path.join(DST, 'rdm', `${PRE}_${name}_lod0.rdm`));
    const b = bounds(H);
    fs.writeFileSync(path.join(DST, `${PRE}_${name}.cfg`), CRLF(cfg([{ file: `${REL}/rdm/${PRE}_${name}_lod0.rdm`, material: material(REL, PRE) }], name, b)));
    fs.writeFileSync(path.join(DST, `${PRE}_${name}.ifo`), CRLF(ifo(arms, FEEDBACK[name], b, H)));
  }
  console.log('installed', Object.keys(PIECES).join(', '), 'into', DST);
}
