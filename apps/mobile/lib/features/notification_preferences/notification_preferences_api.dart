import 'package:dio/dio.dart';

import '../../core/api/api_client.dart';

class NotificationCategory {
  NotificationCategory(Map<String, dynamic> json)
    : id = json['category'] as String,
      label = json['label'] as String,
      configurable = json['configurable'] as bool,
      enabled = json['enabled'] as bool,
      effectiveEnabled = json['effectiveEnabled'] as bool,
      mandatoryOverride = json['mandatoryOverride'] as String?;

  final String id;
  final String label;
  final bool configurable;
  final bool enabled;
  final bool effectiveEnabled;
  final String? mandatoryOverride;
}

class NotificationPreferences {
  NotificationPreferences(Map<String, dynamic> json)
    : version = json['version'] as int,
      categories = (json['categories'] as List)
          .map(
            (item) =>
                NotificationCategory(Map<String, dynamic>.from(item as Map)),
          )
          .toList();

  final int version;
  final List<NotificationCategory> categories;
}

abstract interface class NotificationPreferencesApi {
  Future<NotificationPreferences> load();
  Future<NotificationPreferences> save(int version, Map<String, bool> changes);
  void dispose();
}

class HttpNotificationPreferencesApi implements NotificationPreferencesApi {
  HttpNotificationPreferencesApi(this.client, this.account);
  final ApiClient client;
  final String account;
  final _cancel = CancelToken();
  static const _path = '/notification-preferences';

  @override
  Future<NotificationPreferences> load() async {
    final response = await client.get<Map<String, dynamic>>(
      _path,
      expectedUserId: account,
      cancelToken: _cancel,
    );
    return NotificationPreferences(response.data!);
  }

  @override
  Future<NotificationPreferences> save(
    int version,
    Map<String, bool> changes,
  ) async {
    final response = await client.patch<Map<String, dynamic>>(
      _path,
      expectedUserId: account,
      cancelToken: _cancel,
      data: {
        'version': version,
        'changes': [
          for (final entry in changes.entries)
            {'category': entry.key, 'enabled': entry.value},
        ],
      },
    );
    return NotificationPreferences(response.data!);
  }

  @override
  void dispose() => _cancel.cancel();
}
