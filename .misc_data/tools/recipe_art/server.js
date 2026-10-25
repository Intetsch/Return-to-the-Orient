// Static file server for the coffee recipe drawings + POST /save?name=x.png to write renders to ./out
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, out = path.join(root, 'out');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && u.pathname === '/save') {
    const name = path.basename(u.searchParams.get('name') || 'x.png');
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      const b64 = body.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(out, name), Buffer.from(b64, 'base64'));
      res.end('ok ' + name);
    });
    return;
  }
  let p = path.join(root, decodeURIComponent(u.pathname === '/' ? '/art.html' : u.pathname));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.statusCode = 404; return res.end('404'); }
  res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(p).pipe(res);
}).listen(8765, () => console.log('art server on 8765'));
