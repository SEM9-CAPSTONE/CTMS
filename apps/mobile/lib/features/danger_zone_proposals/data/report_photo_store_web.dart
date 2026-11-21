import 'dart:async';
import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

import 'report_photo_store.dart';

ReportPhotoStore createReportPhotoStore() => IndexedDbReportPhotoStore();

/// IndexedDB holds binary photos far beyond the few-megabyte localStorage quota that the
/// secure storage plugin uses on the web.
class IndexedDbReportPhotoStore implements ReportPhotoStore {
  static const _database = 'ctms_danger_zone_report_photos';
  static const _objectStore = 'photos';
  Future<web.IDBDatabase>? _opened;

  Future<T> _request<T extends JSAny?>(web.IDBRequest request) {
    final completer = Completer<T>();
    request.onsuccess = ((web.Event _) {
      completer.complete(request.result as T);
    }).toJS;
    request.onerror = ((web.Event _) {
      completer.completeError(
        StateError(request.error?.message ?? 'IndexedDB request failed'),
      );
    }).toJS;
    return completer.future;
  }

  Future<web.IDBDatabase> _db() => _opened ??= () {
    final request = web.window.indexedDB.open(_database, 1);
    request.onupgradeneeded = ((web.Event _) {
      final db = request.result as web.IDBDatabase;
      if (!db.objectStoreNames.contains(_objectStore)) {
        db.createObjectStore(_objectStore);
      }
    }).toJS;
    return _request<web.IDBDatabase>(request);
  }();

  Future<web.IDBObjectStore> _store(String mode) async => (await _db())
      .transaction(_objectStore.toJS, mode)
      .objectStore(_objectStore);

  @override
  Future<void> put(String key, Uint8List bytes) async {
    await _request<JSAny?>(
      (await _store('readwrite')).put(bytes.toJS, key.toJS),
    );
  }

  @override
  Future<Uint8List?> get(String key) async {
    final value = await _request<JSAny?>(
      (await _store('readonly')).get(key.toJS),
    );
    if (value == null) return null;
    return (value as JSUint8Array).toDart;
  }

  @override
  Future<void> delete(String key) async {
    await _request<JSAny?>((await _store('readwrite')).delete(key.toJS));
  }
}
