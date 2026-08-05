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

// 远程调试日志：POST /log 接收（页面 ?debug=1 时上报），GET /log 查看
const remoteLogs = [];

https.createServer({
  key: fs.readFileSync(path.join(root, 'local-key.pem')),
  cert: fs.readFileSync(path.join(root, 'local-cert.pem')),
}, (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);

  if (req.method === 'POST' && p === '/log') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const stamped = (data.logs || []).map(l => `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${l}`);
        remoteLogs.push(...stamped);
        if (remoteLogs.length > 1000) remoteLogs.splice(0, remoteLogs.length - 1000);
        console.log('📡 收到真机日志 ' + stamped.length + ' 条（共 ' + remoteLogs.length + '）');
      } catch (e) { /* ignore */ }
      res.writeHead(200); res.end('ok');
    });
    return;
  }

  if (req.method === 'GET' && p === '/log') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(remoteLogs.join('\n') || '(暂无日志 — 手机打开 ?debug=1 页面扫码后这里会出现)');
    return;
  }

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
