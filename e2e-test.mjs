// 端到端测试：虚拟摄像头（条码视频）→ 点击取景框 → 连续帧解码 → 识别成功
// 用法: node e2e-test.mjs
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: 'new',
  args: [
    '--disable-gpu',
    '--ignore-certificate-errors',
    '--no-first-run',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-video-capture=${path.join(root, 'test-video.y4m')}`,
  ],
});

const page = await browser.newPage();
const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

await page.goto('https://localhost:8443/index.html', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 2000));

// 点击取景框打开相机
await page.click('.scan-area');
console.log('✅ 已点击取景框，等待扫码...');

// 等待最多 12 秒识别结果
let found = false;
let statusText = '';
for (let i = 0; i < 24; i++) {
  await new Promise(r => setTimeout(r, 500));
  statusText = await page.$eval('#scanStatusText', el => el.textContent).catch(() => '');
  const modalShown = await page.$eval('#modalOverlay', el => el.classList.contains('show')).catch(() => false);
  if (modalShown) {
    const inputVal = await page.$eval('#manualBarcode', el => el.value).catch(() => '');
    if (inputVal === '6901234567892') {
      found = true;
      console.log(`🎯 端到端识别成功！条码: 6901234567892 （第 ${(i + 1) * 0.5}s 左右）`);
      break;
    }
  }
  // 缓存命中路径：直接显示结果（首次无缓存会走手动输入弹窗）
  const resultShown = await page.$eval('#scanResult', el => el.classList.contains('show')).catch(() => false);
  if (resultShown) {
    const name = await page.$eval('#resultName', el => el.textContent).catch(() => '');
    if (name) { found = true; console.log('🎯 端到端识别成功（结果面板）:', name); break; }
  }
}

console.log('状态栏: ' + statusText);
if (!found) {
  console.log('❌ 未识别到条码。最近日志:');
  logs.slice(-15).forEach(l => console.log('  ' + l));
  // 输出调试面板日志
  const dbg = await page.$eval('#debugPanelBody', el => el.textContent).catch(() => '(debug 面板未开)');
  console.log('--- debug 面板内容 ---');
  console.log(dbg.split('<br>').slice(-20).join('\n'));
}

await browser.close();
process.exit(found ? 0 : 1);
