import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../domain/push_models.dart';

/// The device push service (Firebase Cloud Messaging), behind an interface so tests and builds
/// without a Firebase project never touch the plugin.
abstract interface class PushMessagingPort {
  /// False when push cannot work here (no Firebase config, web/desktop). Never throws.
  Future<bool> initialize();
  Future<PushPermission> requestPermission();
  Future<String?> getToken();
  Stream<String> get onTokenRefresh;

  /// Pushes that arrive while the app is in the foreground (the OS shows nothing then).
  Stream<PushNotice> get onForegroundMessage;

  /// The user tapped a push while the app was in the background.
  Stream<PushNotice> get onMessageOpened;

  /// The push the user tapped to launch the app from a terminated state, if any.
  Future<PushNotice?> getInitialMessage();

  /// `android` / `ios`, as the API expects.
  String get platform;
}

PushNotice _notice(RemoteMessage message) => PushNotice.fromMessage(
  title: message.notification?.title,
  body: message.notification?.body,
  data: message.data,
);

class FirebasePushMessaging implements PushMessagingPort {
  FirebaseMessaging? _messaging;

  @override
  String get platform =>
      defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';

  @override
  Future<bool> initialize() async {
    if (kIsWeb) return false;
    if (defaultTargetPlatform != TargetPlatform.android &&
        defaultTargetPlatform != TargetPlatform.iOS) {
      return false;
    }
    try {
      // Reads google-services.json / GoogleService-Info.plist; throws when the build has none.
      if (Firebase.apps.isEmpty) await Firebase.initializeApp();
      _messaging = FirebaseMessaging.instance;
      return true;
    } catch (_) {
      return false;
    }
  }

  FirebaseMessaging get _fcm {
    final messaging = _messaging;
    if (messaging == null) throw StateError('Push messaging not initialized');
    return messaging;
  }

  @override
  Future<PushPermission> requestPermission() async {
    final settings = await _fcm.requestPermission();
    return switch (settings.authorizationStatus) {
      AuthorizationStatus.authorized ||
      AuthorizationStatus.provisional => PushPermission.granted,
      _ => PushPermission.denied,
    };
  }

  @override
  // The API (CTMS-383) sends to FCM registration tokens. firebase_messaging 17 deprecates them in
  // favour of Installation IDs (register()/onRegistered); switching needs the backend verified
  // against a real Firebase project first (spec ctms-90 PD-6).
  // ignore: deprecated_member_use
  Future<String?> getToken() => _fcm.getToken();

  @override
  Stream<String> get onTokenRefresh =>
      // ignore: deprecated_member_use (see getToken)
      _messaging == null ? const Stream.empty() : _fcm.onTokenRefresh;

  @override
  Stream<PushNotice> get onForegroundMessage => _messaging == null
      ? const Stream.empty()
      : FirebaseMessaging.onMessage.map(_notice);

  @override
  Stream<PushNotice> get onMessageOpened => _messaging == null
      ? const Stream.empty()
      : FirebaseMessaging.onMessageOpenedApp.map(_notice);

  @override
  Future<PushNotice?> getInitialMessage() async {
    if (_messaging == null) return null;
    final message = await _fcm.getInitialMessage();
    return message == null ? null : _notice(message);
  }
}
