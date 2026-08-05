// 本地 HTTPS 服务器（iOS getUserMedia 需要 HTTPS），使用已有自签证书
// 用法: node serve-https.js  然后访问 https://localhost:8443
const https = require('https');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

https.createServer({
  key: fs.readFileSync(path.join(root, 'local-key.pem')),
  cert: fs.readFileSync(path.join(root, 'local-cert.pem')),
}, (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found: ' + p); return; }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}).listen(8443, () => console.log('✅ https://localhost:8443 (iPhone 用同一局域网 IP 访问，需信任证书)'));
