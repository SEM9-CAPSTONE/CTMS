import 'package:flutter/services.dart';

import 'package_storage_capacity.dart';

class DevicePackageStorageCapacity implements PackageStorageCapacity {
  static const channelName = 'ctms/offline_package_storage';
  static const _channel = MethodChannel(channelName);
  @override
  Future<int> availableBytes() async {
    final bytes = await _channel.invokeMethod<int>('availableBytes');
    if (bytes == null || bytes < 0) {
      throw const PackageStorageException(
        'Không kiểm tra được dung lượng trống.',
      );
    }
    return bytes;
  }
}
