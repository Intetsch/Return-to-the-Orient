// Decode a DDS to RGBA8 with texconv and print the mean RGBA of every mip level.
// usage: node mipcheck.js <tmpDir> <file.dds>...
const fs = require('fs'), path = require('path'), cp = require('child_process');
const [tmp, ...files] = process.argv.slice(2);
for (const f of files) {
  cp.execFileSync('C:/tools/texconv.exe', ['-f', 'R8G8B8A8_UNORM', '-y', '-o', tmp, f], { stdio: 'pipe' });
  const b = fs.readFileSync(path.join(tmp, path.basename(f)));
  let w = b.readUInt32LE(16), h = b.readUInt32LE(12);
  const mips = Math.max(1, b.readUInt32LE(28));
  let off = 128 + (b.slice(84, 88).toString() === 'DX10' ? 20 : 0);
  const out = [];
  for (let m = 0; m < mips; m++) {
    const n = w * h, s = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) s[c] += b[off + i * 4 + c];
    out.push(`${w}:` + s.map(x => Math.round(x / n)).join(','));
    off += n * 4; w = Math.max(1, w >> 1); h = Math.max(1, h >> 1);
  }
  console.log(path.basename(f), out.join(' | '));
}
