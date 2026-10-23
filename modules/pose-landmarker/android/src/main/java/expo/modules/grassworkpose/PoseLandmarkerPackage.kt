package expo.modules.grassworkpose

import android.app.Application
import android.content.Context
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Expo autolinking picks up classes implementing [Package] in this module and calls
 * [createApplicationLifecycleListeners] from MainApplication, so `detectPose` is registered
 * before any JS (and therefore before VisionCameraProxy.initFrameProcessorPlugin) runs.
 */
class PoseLandmarkerPackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(object : ApplicationLifecycleListener {
      override fun onCreate(application: Application) {
        PoseRegistration.register(application)
      }
    })
}

object PoseRegistration {
  private val registered = AtomicBoolean(false)

  @Volatile
  var appContext: Context? = null
    private set

  fun isRegistered(): Boolean = registered.get()

  fun register(context: Context) {
    if (appContext == null) appContext = context.applicationContext
    if (!registered.compareAndSet(false, true)) return
    FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectPose") { proxy, options ->
      PoseLandmarkerFrameProcessorPlugin(proxy, options)
    }
  }
}
