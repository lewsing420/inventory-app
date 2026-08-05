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
  if let results = request.results, !results.isEmpty {
    for b in results {
      let conf = String(format: "%.2f", b.confidence)
      print("🎯 \(name) → 识别到条码: \(b.payloadStringValue ?? "?") (\(b.symbology.rawValue) 置信度\(conf))")
    }
  } else {
    print("❌ \(name) → 无条码")
  }
}

for arg in CommandLine.arguments.dropFirst() {
  analyze(arg)
}
