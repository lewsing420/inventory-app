// 用 macOS Vision 框架分析截图：能否检测到条码
// 用法: swift analyze-frames.swift /path/to/image.jpg [更多图片...]
import Vision
import AppKit

func analyze(_ path: String) {
  guard let image = NSImage(contentsOfFile: path),
        let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("❌ 无法读取: \(path)")
    return
  }

  let request = VNDetectBarcodesRequest()
  request.symbologies = [.ean13, .ean8, .upce, .code128, .code39, .qr]
  let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
  do {
    try handler.perform([request])
  } catch {
    print("Vision 错误: \(error)")
    return
  }

  let name = (path as NSString).lastPathComponent
  let W = cgImage.width, H = cgImage.height
  if let results = request.results, !results.isEmpty {
    for b in results {
      let conf = String(format: "%.2f", b.confidence)
      let bb = b.boundingBox // 归一化坐标（左下角原点）
      let x = Int(bb.origin.x * CGFloat(W))
      let y = Int((1 - bb.origin.y - bb.size.height) * CGFloat(H))
      let bw = Int(bb.size.width * CGFloat(W))
      let bh = Int(bb.size.height * CGFloat(H))
      print("🎯 \(name) \(W)x\(H) → 条码 \(b.payloadStringValue ?? "?") 置信度\(conf) 位置(x:\(x),y:\(y) 尺寸:\(bw)x\(bh) 占宽:\(Int(100 * bb.size.width))%)")
    }
  } else {
    print("❌ \(name) \(W)x\(H) → 无条码")
  }
}

for arg in CommandLine.arguments.dropFirst() {
  analyze(arg)
}
