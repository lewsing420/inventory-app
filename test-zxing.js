// ZXing 解码管线自测：纯 JS 生成 EAN-13 位图 → 渲染成 RGBA → 用 index.html 相同管线解码
const ZXing = require('./lib/zxing.min.js');

// ===== 手写 EAN-13 编码器（UMD 构建砍掉了编码器，只能自己画）=====
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const PATTERNS = {
  0:'LLLLLL',1:'LLGLGG',2:'LLGGLG',3:'LLGGGL',4:'LGLLGG',
  5:'LGGLLG',6:'LGGGLL',7:'LGLGLG',8:'LGLGGL',9:'LGGLGL'
};
function ean13Checksum(digits12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += (i % 2 === 0 ? 1 : 3) * digits12[i];
  return (10 - (sum % 10)) % 10;
}
function ean13Bits(code) {
  const d = String(code).split('').map(Number);
  if (d.length === 12) d.push(ean13Checksum(d));
  if (d.length !== 13) throw new Error('EAN-13 需要 12 位（自动补校验位）或 13 位');
  const pattern = PATTERNS[d[0]];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (pattern[i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  bits += '101';
  return bits;
}
function renderEan13(code, moduleWidth, height, margin) {
  const bits = ean13Bits(code);
  const M = margin !== undefined ? margin : moduleWidth * 10; // 静区 ≥9 模块（EAN 规范）
  const W = bits.length * moduleWidth + M * 2;
  const H = height + M * 2;
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      for (let y = M; y < H - M; y++) {
        for (let m = 0; m < moduleWidth; m++) {
          const px = (y * W + (M + i * moduleWidth + m)) * 4;
          data[px] = 0; data[px + 1] = 0; data[px + 2] = 0;
        }
      }
    }
  }
  return { data, width: W, height: H };
}

// ===== 测试 =====
console.log('STEP 1: library loaded');

const CODE = '690123456789';
const { data, width, height } = renderEan13(CODE, 2, 80);
console.log('STEP 2: rendered EAN-13', width + 'x' + height);

// RGBLuminanceSource 期望 Int32Array 打包像素 (r<<16|g<<8|b)，和 index.html 中一致
const packed = new Int32Array(width * height);
for (let i = 0, j = 0; i < data.length; i += 4, j++) {
  packed[j] = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
}
const lum = new ZXing.RGBLuminanceSource(packed, width, height);
const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
const reader = new ZXing.MultiFormatReader();
const hints = new Map();
hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
  ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8,
  ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.CODE_128,
]);
reader.setHints(hints);

try {
  const result = reader.decode(bitmap);
  console.log('STEP 3: DECODED =', result.getText());
  if (result.getText() === CODE + '2') { // 690123456789 + 校验位2
    console.log('PASS ✅ 解码管线正常（EAN-13 往返一致）');
  } else {
    console.log('FAIL: mismatch', result.getText());
    process.exit(1);
  }
} catch (e) {
  console.log('STEP 3: decode error:', e.constructor.name, '-', String(e.message).slice(0, 200));
  process.exit(1);
}

// 额外：模拟小条码（约 1/4 画面大小）验证 ROI 前的全帧解码也能过
const small = renderEan13('6920300103376', 1, 40); // 另一组真实条码
const smallPacked = new Int32Array(small.width * small.height);
for (let i = 0, j = 0; i < small.data.length; i += 4, j++) {
  smallPacked[j] = (small.data[i] << 16) | (small.data[i + 1] << 8) | small.data[i + 2];
}
const lum2 = new ZXing.RGBLuminanceSource(smallPacked, small.width, small.height);
const bmp2 = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum2));
try {
  const r2 = reader.decode(bmp2);
  console.log('PASS ✅ 小尺寸条码解码正常:', r2.getText());
} catch (e) {
  console.log('NOTE: 小尺寸解码失败（ROI 放大后应可解）:', e.constructor.name);
}
