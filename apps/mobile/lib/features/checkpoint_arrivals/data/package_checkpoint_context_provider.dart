import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../core/api/api_exception.dart';
import '../../offline_map/data/offline_map_package_reader.dart';
import '../../offline_map/domain/offline_map_models.dart';
import '../domain/checkpoint_arrival_models.dart';
import 'checkpoint_context_provider.dart';

/// Detection and map must agree on the exact verified, active core package.
/// No fabricated context and no fallback to a different route/version.
class PackageCheckpointContextProvider implements CheckpointContextProvider {
  PackageCheckpointContextProvider({
    required this.client,
    required this.reader,
    required this.cache,
  });
  final ApiClient client;
  final Future<OfflineMapPackageReader> Function() reader;
  final CheckpointContextProvider cache;

  @override
  Future<CheckpointArrivalContext?> getContext(String tripId) async {
    final core = await (await reader()).readActivePackage(tripId);
    if (core == null) return null;
    CheckpointArrivalContext? context;
    try {
      final response = await client.get<Map<String, Object?>>(
        ApiEndpoints.trips.checkpointArrivalContext(tripId),
      );
      if (response.data != null) {
        context = CheckpointArrivalContext.fromJson(response.data!);
      }
    } on ApiException catch (e) {
      if (e.kind != ApiExceptionKind.network &&
          e.kind != ApiExceptionKind.timeout) {
        rethrow;
      }
      context = await cache.getCachedContext(
        tripId,
        packageId: core.packageId,
        packageVersion: core.packageVersion.toString(),
      );
    }
    if (context == null || !matches(core, context)) return null;
    await cache.cacheContext(context);
    return context;
  }

  static bool matches(
    OfflineMapContext core,
    CheckpointArrivalContext context,
  ) {
    if (core.tripId != context.tripId ||
        core.packageId != context.packageId ||
        core.packageVersion.toString() != context.packageVersion ||
        core.route.routeId != context.routeId ||
        context.contextSource == 'dev-fallback' ||
        core.checkpoints.length != context.checkpoints.length) {
      return false;
    }
    for (var i = 0; i < core.checkpoints.length; i++) {
      final a = core.checkpoints[i];
      final b = context.checkpoints[i];
      if (a.id != b.id ||
          a.name != b.name ||
          (a.latitude - b.latitude).abs() > 1e-7 ||
          (a.longitude - b.longitude).abs() > 1e-7) {
        return false;
      }
    }
    return true;
  }

  @override
  Future<void> cacheContext(CheckpointArrivalContext context) =>
      cache.cacheContext(context);
  @override
  Future<CheckpointArrivalContext?> getCachedContext(
    String tripId, {
    String? routeVersion,
    String? packageId,
    String? packageVersion,
  }) => cache.getCachedContext(
    tripId,
    routeVersion: routeVersion,
    packageId: packageId,
    packageVersion: packageVersion,
  );
}
