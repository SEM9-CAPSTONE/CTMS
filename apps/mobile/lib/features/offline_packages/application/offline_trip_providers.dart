import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/offline_trip_repository.dart';
import '../data/package_integrity_service.dart';
import '../domain/offline_package.dart';
import '../domain/offline_trip.dart';
import 'package_download_controller.dart';
import '../../offline_map/data/offline_map_package_reader.dart';
import '../../offline_map/domain/offline_map_models.dart';
import '../data/offline_basemap_store.dart';

typedef SavedTripMap = ({OfflineMapContext context, String? basemapPath});

/// Never substitute another active version for the package being viewed.
final savedTripMapProvider = FutureProvider.autoDispose
    .family<SavedTripMap?, OfflineTripSelection>((ref, selection) async {
      if (ref.watch(offlinePackageAccountProvider) != selection.accountId) {
        return null;
      }
      final store = await ref.watch(packageDownloadStoreProvider.future);
      if (store == null) return null;
      final context = await DefaultOfflineMapPackageReader(
        store: store,
        integrity: PackageIntegrityService(store),
      ).readActivePackage(selection.tripId);
      if (context == null || context.packageVersion != selection.version) {
        return null;
      }
      final active = await store.active(selection.tripId);
      if (active == null || active.id != context.packageId) return null;
      return (
        context: context,
        basemapPath: await OfflineBasemapStore.verifiedLocalPath(
          Directory(
            '${store.root.parent.parent.path}/offline-basemaps/${selection.accountId}',
          ),
          store,
          active,
        ),
      );
    });

typedef OfflineTripSelection = ({String accountId, String tripId, int version});

final offlineTripProvider = FutureProvider.autoDispose
    .family<OfflineTrip?, OfflineTripSelection>((ref, selection) async {
      final account = ref.watch(offlinePackageAccountProvider);
      if (account != selection.accountId) return null;
      final store = await ref.watch(packageDownloadStoreProvider.future);
      if (store == null) return null;
      final repository = OfflineTripRepository(PackageIntegrityService(store));
      return repository.read(selection.tripId, selection.version);
    });

final savedOfflinePackagesProvider = FutureProvider.autoDispose
    .family<List<SavedOfflinePackage>, String>((ref, accountId) async {
      if (ref.watch(offlinePackageAccountProvider) != accountId) return [];
      final store = await ref.watch(packageDownloadStoreProvider.future);
      return store == null ? [] : store.activePackages();
    });
