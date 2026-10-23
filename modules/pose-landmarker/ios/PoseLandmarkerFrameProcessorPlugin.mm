// Registers the Swift frame-processor plugin with VisionCamera under the name `detectPose`.
// JS side: VisionCameraProxy.initFrameProcessorPlugin('detectPose', { model: 'lite' | 'full' }).

#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>
#import <VisionCamera/Frame.h>

// The generated Swift header is named after the pod (GrassworkPose). Its location depends on
// whether pods are built as frameworks (use_frameworks!) or static libraries (Expo default).
#if __has_include(<GrassworkPose/GrassworkPose-Swift.h>)
#import <GrassworkPose/GrassworkPose-Swift.h>
#else
#import "GrassworkPose-Swift.h"
#endif

VISION_EXPORT_SWIFT_FRAME_PROCESSOR(PoseLandmarkerFrameProcessorPlugin, detectPose)
