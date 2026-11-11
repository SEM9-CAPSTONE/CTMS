import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/offline_trip_repository.dart';
import '../data/package_integrity_service.dart';
import '../domain/offline_package.dart';
import '../domain/offline_trip.dart';
import 'package_download_controller.dart';

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
