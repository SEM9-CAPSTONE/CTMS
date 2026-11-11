import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let channel = FlutterMethodChannel(
      name: "ctms/offline_package_storage",
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    channel.setMethodCallHandler { call, result in
      guard call.method == "availableBytes" else {
        result(FlutterMethodNotImplemented)
        return
      }
      do {
        let directory = try FileManager.default.url(
          for: .applicationSupportDirectory, in: .userDomainMask,
          appropriateFor: nil, create: true
        )
        let attributes = try FileManager.default.attributesOfFileSystem(forPath: directory.path)
        guard let bytes = attributes[.systemFreeSize] as? NSNumber else {
          result(FlutterError(code: "STORAGE_UNAVAILABLE", message: "Cannot check available storage", details: nil))
          return
        }
        result(bytes.int64Value)
      } catch {
        result(FlutterError(code: "STORAGE_UNAVAILABLE", message: "Cannot check available storage", details: nil))
      }
    }
  }
}
