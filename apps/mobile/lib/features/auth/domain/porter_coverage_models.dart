/// A district/area (Quận/Huyện) a Porter can register interest in — the
/// scope Host-managed campsites in `PorterCampsiteOption` are grouped by.
class OperatingDistrict {
  const OperatingDistrict({required this.id, required this.name});

  final String id;
  final String name;
}

/// A camping/trekking location a Host legally manages, that a Porter can
/// declare themselves able to guide at. A Porter isn't tied to one
/// location — they can cover several, across different Hosts, as long as
/// they know the terrain (see business rules in the Step 4 refactor).
class PorterCampsiteOption {
  const PorterCampsiteOption({
    required this.id,
    required this.name,
    required this.districtId,
    required this.hostName,
  });

  final String id;
  final String name;
  final String districtId;
  final String hostName;
}
