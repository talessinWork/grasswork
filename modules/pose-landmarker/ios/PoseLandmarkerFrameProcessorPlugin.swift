import AVFoundation
import CoreImage
import Foundation
import MediaPipeTasksVision
import UIKit
import VisionCamera

/// VisionCamera v4 frame-processor plugin `detectPose` (registered in PoseLandmarkerFrameProcessorPlugin.mm).
///
/// Returns per frame:
///   { landmarks: [33 x {x,y,z,visibility}] | null, aspect: Double, t: Double, mirrored: Bool }
/// or { landmarks: null, aspect, t, mirrored, error: String } when the landmarker can't run.
/// Landmarks are normalized to the *oriented* (upright) image, origin top-left.
@objc(PoseLandmarkerFrameProcessorPlugin)
public class PoseLandmarkerFrameProcessorPlugin: FrameProcessorPlugin {
  private var model: String
  private var landmarker: PoseLandmarker?
  private var loadedModel: String?
  private var initError: String?
  private var lastTimestampMs: Int = -1

  // Lazily created, only used when the camera delivers non-BGRA frames (pixelFormat 'yuv').
  private lazy var ciContext = CIContext(options: [.cacheIntermediates: false])
  private var bgraPool: CVPixelBufferPool?
  private var bgraPoolSize: (Int, Int) = (0, 0)

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    self.model = (options?["model"] as? String) == "full" ? "full" : "lite"
    super.init(proxy: proxy, options: options)
  }

  // MARK: - Landmarker

  private func ensureLandmarker(model: String) -> PoseLandmarker? {
    if let l = landmarker, loadedModel == model { return l }
    // A previous attempt for this model failed: don't retry on every frame.
    if loadedModel == model, initError != nil { return nil }

    landmarker = nil
    loadedModel = model
    initError = nil
    lastTimestampMs = -1

    guard let path = PoseModelFile.path(for: model) else {
      initError = "pose_landmarker_\(model).task not found in app bundle (run scripts/download-models.sh, then prebuild)"
      return nil
    }
    let options = PoseLandmarkerOptions()
    options.baseOptions.modelAssetPath = path
    // CPU is the safe default. `.GPU` is faster on recent devices; try it once everything works.
    // options.baseOptions.delegate = .GPU
    options.runningMode = .video
    options.numPoses = 1
    options.minPoseDetectionConfidence = 0.5
    options.minPosePresenceConfidence = 0.5
    options.minTrackingConfidence = 0.5
    do {
      landmarker = try PoseLandmarker(options: options)
    } catch {
      initError = "PoseLandmarker init failed: \(error.localizedDescription)"
    }
    return landmarker
  }

  // MARK: - Frame callback

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
    if let m = arguments?["model"] as? String { model = (m == "full") ? "full" : "lite" }

    let sampleBuffer = frame.buffer
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return nil }

    // --- orientation -------------------------------------------------------------------
    // VisionCamera v4 delivers frames in the sensor's native (landscape) orientation and
    // reports in `frame.orientation` how to rotate them to upright. MediaPipe rejects mirrored
    // UIImage.Orientation values, so mirroring is stripped here and reported via `mirrored`.
    // FIRST-BUILD CHECK: hold the phone upright, stand in frame — nose.y must be < ankle.y.
    // If the skeleton comes out rotated by 180°/90°, adjust `uprightOrientation` (some 4.x
    // releases reported the inverse rotation).
    var (orientation, orientationMirrored) = Self.uprightOrientation(frame.orientation)
    let mirrored = frame.isMirrored || orientationMirrored
    // A buffer mirrored in sensor (landscape) space needs the OPPOSITE 90° rotation to come out
    // head-up (rotate(flipH(B)) by θ == flipH(rotate(B) by -θ)). Whether VisionCamera already folds
    // that into `frame.orientation` varies between 4.x releases.
    // FIRST-BUILD CHECK (front camera): if the skeleton is upside down, flip this constant.
    if mirrored && Self.swapRotationWhenMirrored {
      if orientation == .left { orientation = .right } else if orientation == .right { orientation = .left }
    }

    let bw = Double(CVPixelBufferGetWidth(pixelBuffer))
    let bh = Double(CVPixelBufferGetHeight(pixelBuffer))
    let sideways = (orientation == .left || orientation == .right)
    let aspect = sideways ? bh / bw : bw / bh

    // --- timestamp: strictly increasing ms, required by VIDEO running mode ----------------
    let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
    var ts = pts.isValid ? Int((CMTimeGetSeconds(pts) * 1000.0).rounded()) : lastTimestampMs + 1
    if ts <= lastTimestampMs { ts = lastTimestampMs + 1 }

    var out: [String: Any] = [
      "landmarks": NSNull(),
      "aspect": aspect,
      "t": Double(ts),
      "mirrored": mirrored,
    ]

    guard let landmarker = ensureLandmarker(model: model) else {
      out["error"] = initError ?? "PoseLandmarker unavailable"
      return out
    }

    do {
      let image: MPImage
      if CVPixelBufferGetPixelFormatType(pixelBuffer) == kCVPixelFormatType_32BGRA {
        image = try MPImage(pixelBuffer: pixelBuffer, orientation: orientation)
      } else {
        // MediaPipe iOS only accepts 32BGRA. Prefer <Camera pixelFormat="rgb"> to skip this copy.
        guard let bgra = convertToBGRA(pixelBuffer) else {
          out["error"] = "could not convert frame to BGRA"
          return out
        }
        image = try MPImage(pixelBuffer: bgra, orientation: orientation)
      }

      let result = try landmarker.detect(videoFrame: image, timestampInMilliseconds: ts)
      lastTimestampMs = ts

      if let pose = result.landmarks.first, pose.count >= 33 {
        out["landmarks"] = pose.prefix(33).map { lm -> [String: Double] in
          [
            "x": Double(lm.x),
            "y": Double(lm.y),
            "z": Double(lm.z),
            "visibility": lm.visibility?.doubleValue ?? 0,
          ]
        }
      }
    } catch {
      // A timestamp error here means two frames shared a ts: lastTimestampMs guards against that,
      // so anything else is a real failure worth surfacing in JS.
      lastTimestampMs = ts
      out["error"] = "detect failed: \(error.localizedDescription)"
    }
    return out
  }

  // MARK: - Helpers

  /// See the FIRST-BUILD CHECK in `callback`.
  static let swapRotationWhenMirrored = false

  /// Splits a UIImage.Orientation into a non-mirrored one MediaPipe accepts + a mirrored flag.
  static func uprightOrientation(_ o: UIImage.Orientation) -> (UIImage.Orientation, Bool) {
    switch o {
    case .up: return (.up, false)
    case .down: return (.down, false)
    case .left: return (.left, false)
    case .right: return (.right, false)
    case .upMirrored: return (.up, true)
    case .downMirrored: return (.down, true)
    case .leftMirrored: return (.left, true)
    case .rightMirrored: return (.right, true)
    @unknown default: return (.up, false)
    }
  }

  private func convertToBGRA(_ src: CVPixelBuffer) -> CVPixelBuffer? {
    let w = CVPixelBufferGetWidth(src)
    let h = CVPixelBufferGetHeight(src)
    if bgraPool == nil || bgraPoolSize != (w, h) {
      let attrs: [String: Any] = [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: w,
        kCVPixelBufferHeightKey as String: h,
        kCVPixelBufferIOSurfacePropertiesKey as String: [:] as [String: Any],
      ]
      var pool: CVPixelBufferPool?
      CVPixelBufferPoolCreate(kCFAllocatorDefault, nil, attrs as CFDictionary, &pool)
      bgraPool = pool
      bgraPoolSize = (w, h)
    }
    guard let pool = bgraPool else { return nil }
    var dst: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &dst)
    guard let out = dst else { return nil }
    ciContext.render(CIImage(cvPixelBuffer: src), to: out)
    return out
  }
}
