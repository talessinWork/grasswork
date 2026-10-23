import ExpoModulesCore

/// Tiny Expo module next to the frame-processor plugin. The plugin itself is registered with
/// VisionCamera at load time (see PoseLandmarkerFrameProcessorPlugin.mm), so `install` is a no-op here.
public class PoseLandmarkerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PoseLandmarker")

    Function("install") { () -> Bool in
      return true
    }

    Function("isModelBundled") { (model: String) -> Bool in
      return PoseModelFile.path(for: model) != nil
    }
  }
}

enum PoseModelFile {
  /// "lite" | "full" -> pose_landmarker_<model>.task in the main bundle (copied there by app.plugin.js).
  static func path(for model: String) -> String? {
    let name = model == "full" ? "pose_landmarker_full" : "pose_landmarker_lite"
    return Bundle.main.path(forResource: name, ofType: "task")
  }
}
