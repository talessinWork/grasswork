package expo.modules.grassworkpose

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Small Expo module beside the `detectPose` frame-processor plugin.
 * Registration with VisionCamera happens as early as possible (Application.onCreate via
 * [PoseLandmarkerPackage], then again here and in `install()`); it is idempotent.
 */
class PoseLandmarkerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PoseLandmarker")

    OnCreate {
      appContext.reactContext?.applicationContext?.let { PoseRegistration.register(it) }
    }

    Function("install") {
      val ctx = appContext.reactContext?.applicationContext
      if (ctx != null) PoseRegistration.register(ctx)
      PoseRegistration.isRegistered()
    }

    Function("isModelBundled") { model: String ->
      val ctx = appContext.reactContext?.applicationContext ?: return@Function false
      PoseModelFile.exists(ctx, model)
    }
  }
}

object PoseModelFile {
  fun assetName(model: String): String =
    if (model == "full") "pose_landmarker_full.task" else "pose_landmarker_lite.task"

  fun exists(ctx: Context, model: String): Boolean =
    try {
      ctx.assets.list("")?.contains(assetName(model)) == true
    } catch (_: Exception) {
      false
    }
}
