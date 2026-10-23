require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# NOTE: the pod is deliberately NOT called "PoseLandmarker". MediaPipe exposes a Swift class named
# `PoseLandmarker`; a Swift module with the same name makes every `PoseLandmarker` reference ambiguous.
Pod::Spec.new do |s|
  s.name           = 'GrassworkPose'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'Grasswork'
  s.homepage       = 'https://github.com/talessin/grasswork'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'VisionCamera'
  # Pulls in MediaPipeTasksCommon too. If the app crashes at landmarker creation with
  # "Unregistered type" / missing calculator errors, the -force_load linker flags that
  # MediaPipeTasksCommon adds to the *user target* were lost (check the app target's OTHER_LDFLAGS).
  s.dependency 'MediaPipeTasksVision', '~> 0.10.14'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
