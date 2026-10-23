package expo.modules.grassworkpose

import android.graphics.Bitmap
import android.graphics.Matrix
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import kotlin.math.max

/**
 * VisionCamera v4 frame-processor plugin `detectPose` (registered in [PoseRegistration]).
 *
 * Returns per frame:
 *   { landmarks: [33 x {x,y,z,visibility}] | null, aspect: Double, t: Double, mirrored: Boolean }
 * plus `error: String` when the landmarker can't run. Landmarks are normalized to the upright
 * (rotated) image, origin top-left.
 */
class PoseLandmarkerFrameProcessorPlugin(
  @Suppress("UNUSED_PARAMETER") proxy: VisionCameraProxy,
  options: Map<String, Any>?,
) : FrameProcessorPlugin() {

  private var model: String = if (options?.get("model") == "full") "full" else "lite"
  private var landmarker: PoseLandmarker? = null
  private var loadedModel: String? = null
  private var initError: String? = null
  private var lastTimestampMs: Long = -1
  private val matrix = Matrix()

  private fun ensureLandmarker(model: String): PoseLandmarker? {
    landmarker?.let { if (loadedModel == model) return it }
    if (loadedModel == model && initError != null) return null

    landmarker?.close()
    landmarker = null
    loadedModel = model
    initError = null
    lastTimestampMs = -1

    val ctx = PoseRegistration.appContext
    if (ctx == null) {
      initError = "no application context (PoseRegistration.register was never called)"
      return null
    }
    val asset = PoseModelFile.assetName(model)
    if (!PoseModelFile.exists(ctx, model)) {
      initError = "$asset not found in APK assets (run scripts/download-models.sh, then prebuild)"
      return null
    }
    return try {
      val base = BaseOptions.builder()
        .setModelAssetPath(asset)
        // CPU is the safe default; Delegate.GPU is faster on most phones once things work.
        .setDelegate(Delegate.CPU)
        .build()
      val opts = PoseLandmarker.PoseLandmarkerOptions.builder()
        .setBaseOptions(base)
        .setRunningMode(RunningMode.VIDEO)
        .setNumPoses(1)
        .setMinPoseDetectionConfidence(0.5f)
        .setMinPosePresenceConfidence(0.5f)
        .setMinTrackingConfidence(0.5f)
        .build()
      PoseLandmarker.createFromOptions(ctx, opts).also { landmarker = it }
    } catch (e: Exception) {
      initError = "PoseLandmarker init failed: ${e.message}"
      Log.e(TAG, initError!!, e)
      null
    }
  }

  override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
    (arguments?.get("model") as? String)?.let { model = if (it == "full") "full" else "lite" }

    // --- timestamp: strictly increasing ms (VIDEO mode throws otherwise) -----------------
    var ts = frame.timestamp / 1_000_000L // frame.timestamp is in ns
    if (ts <= lastTimestampMs) ts = lastTimestampMs + 1

    // --- orientation ----------------------------------------------------------------------
    // CameraX's rotationDegrees = clockwise rotation that makes the buffer upright for the
    // current target rotation. FIRST-BUILD CHECK: phone upright, stand in frame — nose.y must
    // be < ankle.y. If the skeleton is rotated, VisionCamera's ImageAnalysis target rotation
    // differs from what we assume; try (360 - rotation) % 360 or frame.orientation instead.
    val imageProxy = frame.imageProxy
    val rotation = imageProxy.imageInfo.rotationDegrees
    // Android front-camera frames are NOT pixel-mirrored (only the preview is).
    val mirrored = false

    val sideways = rotation == 90 || rotation == 270
    val w = frame.width.toDouble()
    val h = frame.height.toDouble()
    val aspect = if (sideways) h / w else w / h

    val out = HashMap<String, Any?>()
    out["landmarks"] = null
    out["aspect"] = aspect
    out["t"] = ts.toDouble()
    out["mirrored"] = mirrored

    val lm = ensureLandmarker(model)
    if (lm == null) {
      out["error"] = initError ?: "PoseLandmarker unavailable"
      return out
    }

    try {
      // ImageProxy.toBitmap() (CameraX >= 1.3) handles both YUV_420_888 ('yuv') and RGBA_8888 ('rgb').
      val src = imageProxy.toBitmap()
      val upright = uprightScaled(src, rotation)
      val mpImage = BitmapImageBuilder(upright).build()
      val result = lm.detectForVideo(mpImage, ts)
      lastTimestampMs = ts

      val poses = result.landmarks()
      if (poses.isNotEmpty() && poses[0].size >= 33) {
        out["landmarks"] = poses[0].take(33).map { p ->
          mapOf(
            "x" to p.x().toDouble(),
            "y" to p.y().toDouble(),
            "z" to p.z().toDouble(),
            "visibility" to (p.visibility().orElse(0f)).toDouble(),
          )
        }
      }
      if (upright !== src) upright.recycle()
      src.recycle()
    } catch (e: Exception) {
      lastTimestampMs = ts
      out["error"] = "detect failed: ${e.message}"
    }
    return out
  }

  /** Rotates to upright and downsizes so the long edge is <= MAX_EDGE (pose models use 256 px input). */
  private fun uprightScaled(src: Bitmap, rotation: Int): Bitmap {
    val scale = minOf(1f, MAX_EDGE.toFloat() / max(src.width, src.height))
    if (rotation == 0 && scale >= 1f) return src
    matrix.reset()
    if (scale < 1f) matrix.postScale(scale, scale)
    if (rotation != 0) matrix.postRotate(rotation.toFloat())
    return Bitmap.createBitmap(src, 0, 0, src.width, src.height, matrix, true)
  }

  companion object {
    private const val TAG = "GrassworkPose"
    private const val MAX_EDGE = 640
  }
}
