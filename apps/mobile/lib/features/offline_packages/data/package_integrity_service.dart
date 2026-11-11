import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../domain/offline_package.dart';
import 'package_download_store.dart';
import 'package_integrity_verifier.dart';

class PackageIntegrityService {
  PackageIntegrityService(
    this.store, {
    this.verifier = const PackageIntegrityVerifier(),
  });
  final PackageDownloadStore store;
  final PackageIntegrityVerifier verifier;

  Future<(PackageVerificationStatus, bool activated)> finalize(
    OfflinePackage package,
    CancelToken cancel, {
    Future<OfflinePackage?> Function()? authorizeReplacement,
    String? tripTitle,
  }) async {
    void checkCancelled() => _checkCancelled(cancel);
    final tripId = package.tripId;
    final result = await store.withIntegrityLock(tripId, () async {
      checkCancelled();
      final prior = await store.verification(package);
      if (prior == PackageVerificationStatus.failed) return (prior, false);
      if (prior == PackageVerificationStatus.pending &&
          !await store.hasCompletedTransfer(package)) {
        return (prior, false);
      }
      final (valid, _) = await _validate(package, checkCancelled);
      if (!valid) return (PackageVerificationStatus.failed, false);
      if (prior != PackageVerificationStatus.verified) {
        await store.saveVerification(
          package,
          PackageVerificationStatus.verified,
          checkCancelled,
        );
      }
      if (await store.accessDenied(tripId)) {
        return (PackageVerificationStatus.verified, false);
      }
      final active = await store.active(tripId);
      checkCancelled();
      if (active?.sameArtifact(package) == true) {
        return (PackageVerificationStatus.verified, true);
      }
      final firstActivation =
          active == null && package.activationAllowed != false;
      if (firstActivation) {
        await store.saveActive(package, checkCancelled, tripTitle: tripTitle);
      }
      return (PackageVerificationStatus.verified, firstActivation);
    });
    if (result.$1 != PackageVerificationStatus.verified ||
        result.$2 ||
        authorizeReplacement == null) {
      return result;
    }
    final active = await store.active(tripId);
    if (active == null || active.packageVersion >= package.packageVersion) {
      return result;
    }

    // Old active bytes remain readable while the server checks replacement policy.
    checkCancelled();
    final approved = await authorizeReplacement();
    if (approved == null ||
        approved.activationAllowed != true ||
        !package.sameArtifact(approved)) {
      return result;
    }
    return store.withIntegrityLock(tripId, () async {
      checkCancelled();
      final current = await store.active(tripId);
      if (current?.sameArtifact(package) == true) {
        return (PackageVerificationStatus.verified, true);
      }
      if (current == null ||
          current.packageVersion >= package.packageVersion ||
          !await _isVerified(package) ||
          await store.accessDenied(tripId)) {
        return result;
      }
      final (valid, _) = await _validate(package, checkCancelled);
      if (!valid) return (PackageVerificationStatus.failed, false);
      await store.saveActive(package, checkCancelled, tripTitle: tripTitle);
      return (PackageVerificationStatus.verified, true);
    });
  }

  Future<OfflinePackage?> activePackage(String tripId, CancelToken cancel) =>
      store.withIntegrityLock(tripId, () async {
        if (await store.accessDenied(tripId)) return null;
        final active = await store.active(tripId);
        if (active == null || !await _isVerified(active)) return null;
        final (valid, _) = await _validate(
          active,
          () => _checkCancelled(cancel),
        );
        return valid && !await store.accessDenied(tripId) ? active : null;
      });

  /// CTMS-224 boundary. Returns the checked byte snapshot, so a later file
  /// change cannot substitute a different ZIP between verification and use.
  Future<Uint8List?> openActive(String tripId, int version) => _readActive(
    tripId,
    version,
    (package, path) => verifier.verify(package, path, includeBytes: true),
  );

  Future<T?> readActive<T>(
    String tripId,
    int version,
    T Function(Map<String, Uint8List>) decode,
  ) => _readActive(
    tripId,
    version,
    (package, path) => verifier.read(package, path, decode),
  );

  Future<T?> _readActive<T>(
    String tripId,
    int version,
    Future<T?> Function(OfflinePackage, String) read,
  ) => store.withIntegrityLock(tripId, () async {
    if (await store.accessDenied(tripId)) return null;
    final active = await store.active(tripId);
    if (active == null ||
        active.packageVersion != version ||
        !await _isVerified(active)) {
      return null;
    }
    final (_, snapshot) = await _validateWith(active, () {}, read);
    return await store.accessDenied(tripId) ? null : snapshot;
  });

  /// Opens the current active package for [tripId] and returns its verified byte
  /// snapshot alongside the package metadata.
  Future<({OfflinePackage package, Uint8List bytes})?> openActivePackage(
    String tripId, {
    CancelToken? cancel,
  }) =>
      store.withIntegrityLock(tripId, () async {
        if (await store.accessDenied(tripId)) return null;
        final active = await store.active(tripId);
        if (active == null || !await _isVerified(active)) {
          return null;
        }
        final (valid, bytes) = await _validate(
          active,
          () => cancel != null ? _checkCancelled(cancel) : null,
          includeBytes: true,
        );
        if (!valid || bytes == null || await store.accessDenied(tripId)) {
          return null;
        }
        return (package: active, bytes: bytes);
      });

  Future<bool> _isVerified(OfflinePackage package) async =>
      await store.verification(package) == PackageVerificationStatus.verified;

  void _checkCancelled(CancelToken cancel) {
    final error = cancel.cancelError;
    if (error != null) throw error;
  }

  Future<(bool, Uint8List?)> _validate(
    OfflinePackage package,
    void Function() checkCancelled,
  ) => _validateWith(package, checkCancelled, verifier.verify);

  Future<(bool, T?)> _validateWith<T>(
    OfflinePackage package,
    void Function() checkCancelled,
    Future<T?> Function(OfflinePackage, String) read,
  ) async {
    checkCancelled();
    try {
      final snapshot = await read(package, store.archive(package).path);
      checkCancelled();
      return (true, snapshot);
    } on Exception catch (failure) {
      if (failure is! FormatException && failure is! FileSystemException) {
        rethrow;
      }
      await store.saveVerification(
        package,
        PackageVerificationStatus.failed,
        checkCancelled,
      );
      return (false, null);
    }
  }
}
