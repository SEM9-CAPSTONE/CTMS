import '../domain/offline_trip.dart';
import 'offline_package_reader.dart';
import 'package_integrity_service.dart';

class OfflineTripRepository {
  OfflineTripRepository(this._integrity);

  final PackageIntegrityService _integrity;

  Future<OfflineTrip?> read(String tripId, int version) =>
      _integrity.readActive(tripId, version, decodeOfflineTrip);
}
