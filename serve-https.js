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
// 调试截图：POST /upload 接收（页面 ?debug=1 时上传），存 /tmp/remote-frames
const frameDir = '/tmp/remote-frames';
if (!fs.existsSync(frameDir)) fs.mkdirSync(frameDir, { recursive: true });

https.createServer({
  key: fs.readFileSync(path.join(root, 'local-key.pem')),
  cert: fs.readFileSync(path.join(root, 'local-cert.pem')),
}, (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);

  if (req.method === 'POST' && p === '/upload') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const label = String(req.url.split('label=')[1] || 'frame').slice(0, 40).replace(/[^a-zA-Z0-9-_]/g, '');
      const file = path.join(frameDir, Date.now() + '-' + label + '.jpg');
      fs.writeFile(file, Buffer.concat(chunks), () => console.log('📸 收到真机截图: ' + label));
      res.writeHead(200); res.end('ok');
    });
    return;
  }

  if (req.method === 'GET' && p === '/frames') {
    fs.readdir(frameDir, (err, files) => {
      if (err) { res.writeHead(200); res.end('(暂无截图)'); return; }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(files.sort().reverse().slice(0, 30).join('\n'));
    });
    return;
  }

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
