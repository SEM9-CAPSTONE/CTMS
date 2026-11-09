package com.ctms.mobile

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.os.StatFs

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "ctms/offline_package_storage")
            .setMethodCallHandler { call, result ->
                if (call.method != "availableBytes") {
                    result.notImplemented()
                } else {
                    try {
                        result.success(StatFs(filesDir.absolutePath).availableBytes)
                    } catch (error: Exception) {
                        result.error("STORAGE_UNAVAILABLE", "Cannot check available storage", null)
                    }
                }
            }
    }
}
