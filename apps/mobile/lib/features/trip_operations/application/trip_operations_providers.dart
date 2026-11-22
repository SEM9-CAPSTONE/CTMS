import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/application/auth_controller.dart';
import '../data/trip_operations_api.dart';
import '../domain/operational_trip.dart';

final porterOperationsAccountProvider = Provider<String?>((ref) {
  final user = ref.watch(authControllerProvider).asData?.value;
  return user?.id;
});

final selectedPorterTripIdProvider = StateProvider<String?>((ref) => null);

final assignedOperationalTripsProvider = FutureProvider.autoDispose
    .family<List<OperationalTrip>, String>((ref, accountId) {
      if (ref.watch(porterOperationsAccountProvider) != accountId) return [];
      return ref.watch(tripOperationsApiProvider).assigned(accountId);
    });

typedef TripOperationsKey = ({String accountId, String tripId});

final tripLifecycleProvider = FutureProvider.autoDispose
    .family<TripLifecycle, TripOperationsKey>((ref, key) {
      if (ref.watch(porterOperationsAccountProvider) != key.accountId) {
        throw StateError('Session changed');
      }
      return ref
          .watch(tripOperationsApiProvider)
          .context(key.accountId, key.tripId);
    });
