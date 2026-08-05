// 生成测试用 y4m 视频（黑白色条码画面），供 Chrome 虚拟摄像头端到端测试
// 用法: node generate-test-video.js   → 输出 test-video.y4m
const fs = require('fs');

// EAN-13 位模式（与 test-zxing.js 相同）
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const PATTERNS = { 0:'LLLLLL',1:'LLGLGG',2:'LLGGLG',3:'LLGGGL',4:'LGLLGG',5:'LGGLLG',6:'LGGGLL',7:'LGLGLG',8:'LGLGGL',9:'LGGLGL' };

function ean13Bits(code) {
  const d = String(code).split('').map(Number);
  while (d.length < 12) d.unshift(0);
  if (d.length === 12) {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += (i % 2 === 0 ? 1 : 3) * d[i];
    d.push((10 - (sum % 10)) % 10);
  }
  const pattern = PATTERNS[d[0]];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (pattern[i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  bits += '101';
  return bits;
}

const W = 640, H = 480, FPS = 30, SECONDS = 8;
const bits = ean13Bits('690123456789'); // 校验位自动补 → 6901234567892
const mw = 5;                     // 模块宽 5px
const barW = bits.length * mw;    // 475px
const quiet = Math.floor((W - barW) / 2); // 两侧静区 82px ≈ 16 模块 ✓
const barTop = 130, barH = 220;

// YUV420: Y 全平面 + U + V（黑白画面 U=V=128）
const frameSize = W * H + (W / 2) * (H / 2) * 2;
const yBuf = Buffer.alloc(W * H, 205);   // 浅灰背景
const uvBuf = Buffer.alloc((W / 2) * (H / 2) * 2, 128);

// 画条码到 Y 平面（每帧重画，价格便宜）
function drawBarcode() {
  yBuf.fill(205); // 重置背景
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      const x0 = quiet + i * mw;
      for (let y = barTop; y < barTop + barH; y++) {
        for (let x = x0; x < x0 + mw; x++) {
          yBuf[y * W + x] = 10; // 近黑
        }
      }
    }
  }
}
drawBarcode();

// 帧间微移模拟手持抖动（±3px 正弦），让测试更接近真实
let chunks = [];
chunks.push(Buffer.from(`YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`));
const totalFrames = FPS * SECONDS;
for (let f = 0; f < totalFrames; f++) {
  const shift = Math.round(Math.sin(f / 8) * 3);
  if (shift !== 0) {
    // 简化：只对条码行做平移重绘
    yBuf.fill(205);
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === '1') {
        const x0 = quiet + i * mw + shift;
        for (let y = barTop; y < barTop + barH; y++) {
          for (let x = x0; x < x0 + mw; x++) {
            if (x >= 0 && x < W) yBuf[y * W + x] = 10;
          }
        }
      }
    }
  }
  chunks.push(Buffer.from('FRAME\n'));
  chunks.push(Buffer.from(yBuf));
  chunks.push(Buffer.from(uvBuf));
  if (f % 60 === 0) process.stdout.write(`frame ${f}/${totalFrames}\r`);
}
fs.writeFileSync('test-video.y4m', Buffer.concat(chunks));
console.log('\n✅ test-video.y4m (' + (totalFrames / FPS) + 's, ' + (fs.statSync('test-video.y4m').size / 1048576).toFixed(1) + ' MB)');
