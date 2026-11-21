/// A server-confirmed position, kept separate from this device's live GPS.
class SyncedMapMember {
  const SyncedMapMember({
    required this.id,
    required this.label,
    required this.latitude,
    required this.longitude,
    required this.routeLabel,
    required this.stale,
    required this.offRoute,
  });
  final String id;
  final String label;
  final double latitude;
  final double longitude;
  final String routeLabel;
  final bool stale;
  final bool offRoute;
}
