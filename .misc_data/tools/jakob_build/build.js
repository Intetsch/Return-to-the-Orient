// Headless run of anno-modding-tools' ModBuilder (VS Code extension bundle) with a stubbed vscode module.
// usage: node build.js <extDir> <modinfo.json> <outFolder> <annoRda>
const fs = require('fs'), path = require('path'), Module = require('module');
const [extDir, modinfo, outFolder, annoRda] = process.argv.slice(2);

function stub(name) {
  const f = function () { return stub(name + '()'); };
  return new Proxy(f, {
    get(t, p) {
      if (p === Symbol.toPrimitive) return () => '';
      if (p === 'then') return undefined;
      if (p === 'prototype') return t.prototype;
      return stub(name + '.' + String(p));
    },
    apply() { return stub(name + '()'); },
    construct() { return stub('new ' + name); },
  });
}
const vscode = stub('vscode');
const origLoad = Module._load;
Module._load = function (req, ...rest) { return req === 'vscode' ? vscode : origLoad.call(this, req, ...rest); };

const file = path.join(extDir, 'dist', 'extension.js');
let src = fs.readFileSync(file, 'utf8');
const tail = 'module.exports=r})();';
if (!src.includes(tail)) throw new Error('bundle tail not found');
src = src.replace(tail, 'module.exports=r,r.__req=n})();');
const m = new Module(file, module);
m.filename = file;
m.paths = Module._nodeModulePaths(path.dirname(file));
m._compile(src, file);
const req = m.exports.__req;
const { ModBuilder } = req(1432);

const logger = {
  log: (...a) => console.log(...a), warn: (...a) => console.log('WARN', ...a),
  error: (...a) => console.log('ERROR', ...a), show() {},
};
const builder = new ModBuilder(logger, p => path.join(extDir, p), { annoMods: path.dirname(outFolder), annoRda });
builder.build(modinfo, outFolder).then(ok => { console.log('BUILD RESULT', ok); process.exit(ok ? 0 : 1); },
  e => { console.log('BUILD THREW', e); process.exit(2); });
