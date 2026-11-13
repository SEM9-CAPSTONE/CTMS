/// Server evidence remains separate from local byte verification.
class PackagePolicy {
  PackagePolicy(this.json);
  final Map<String, Object?> json;
  Map<String, Object?> section(String name) =>
      Map<String, Object?>.from(json[name] as Map);
  String get tripStatus => json['tripStatus'] as String;
  String get checkedAt => json['checkedAt'] as String;
  String get sourceState => section('sourceFreshness')['state'] as String;
  bool get replaceAllowed => json['replaceAllowed'] == true;
  bool get newerAvailable => section('publication')['newerAvailable'] == true;
  bool get updateRequired => section('publication')['updateRequired'] == true;
  String? get requiredId =>
      section('publication')['requiredPackageId'] as String?;
  int? get requiredVersion => section('publication')['requiredVersion'] as int?;
  String? get lockedId => json['lockedPackageId'] as String?;
  bool get hasRequirement => requiredId != null;
}
