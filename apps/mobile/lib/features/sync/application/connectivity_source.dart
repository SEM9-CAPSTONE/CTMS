import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Abstraction over network connectivity status to allow deterministic testing (CTMS-065).
abstract class ConnectivitySource {
  Future<bool> isConnected();
  Stream<bool> get onConnectivityChanged;
}

class DefaultConnectivitySource implements ConnectivitySource {
  DefaultConnectivitySource([Connectivity? connectivity])
      : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;

  static bool _hasConnection(List<ConnectivityResult> results) {
    return results.any((r) => r != ConnectivityResult.none);
  }

  @override
  Future<bool> isConnected() async {
    try {
      final results = await _connectivity.checkConnectivity();
      return _hasConnection(results);
    } catch (_) {
      return false;
    }
  }

  @override
  Stream<bool> get onConnectivityChanged {
    return _connectivity.onConnectivityChanged.map(_hasConnection).distinct();
  }
}

final connectivitySourceProvider = Provider<ConnectivitySource>((ref) {
  return DefaultConnectivitySource();
});
