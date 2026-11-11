class AllergyItem {
  const AllergyItem({
    required this.id,
    required this.name,
    required this.severity,
    this.reaction,
  });

  final String id;
  final String name;
  final String severity; // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  final String? reaction;

  factory AllergyItem.fromJson(Map<String, dynamic> json) {
    return AllergyItem(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      severity: json['severity'] as String? ?? 'LOW',
      reaction: json['reaction'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'severity': severity,
    if (reaction != null && reaction!.trim().isNotEmpty) 'reaction': reaction!.trim(),
  };
}

class MedicalConditionItem {
  const MedicalConditionItem({
    required this.id,
    required this.name,
    this.medication,
    this.notes,
  });

  final String id;
  final String name;
  final String? medication;
  final String? notes;

  factory MedicalConditionItem.fromJson(Map<String, dynamic> json) {
    return MedicalConditionItem(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      medication: json['medication'] as String?,
      notes: json['notes'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    if (medication != null && medication!.trim().isNotEmpty) 'medication': medication!.trim(),
    if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
  };
}

class HealthSharingConsent {
  const HealthSharingConsent({
    required this.isConsentGranted,
    required this.allowedRoles,
    this.grantedAt,
    this.revokedAt,
    this.activeTripScope,
  });

  final bool isConsentGranted;
  final List<String> allowedRoles;
  final String? grantedAt;
  final String? revokedAt;
  final String? activeTripScope;

  factory HealthSharingConsent.fromJson(Map<String, dynamic> json) {
    final roles = json['allowedRoles'];
    return HealthSharingConsent(
      isConsentGranted: json['isConsentGranted'] as bool? ?? false,
      allowedRoles: roles is List ? List<String>.from(roles) : const [],
      grantedAt: json['grantedAt'] as String?,
      revokedAt: json['revokedAt'] as String?,
      activeTripScope: json['activeTripScope'] as String?,
    );
  }
}

class HealthProfile {
  const HealthProfile({
    required this.id,
    required this.camperId,
    required this.camperName,
    required this.bloodType,
    required this.physicalFitnessLevel,
    required this.dietaryRestrictions,
    required this.emergencyNotes,
    required this.allergies,
    required this.medicalConditions,
    required this.consent,
    required this.accountStatus,
    required this.updatedAt,
    required this.version,
  });

  final String id;
  final String camperId;
  final String camperName;
  final String bloodType; // 'A+' | 'A-' | etc.
  final String physicalFitnessLevel; // 'BEGINNER' | 'INTERMEDIATE' | etc.
  final String dietaryRestrictions;
  final String emergencyNotes;
  final List<AllergyItem> allergies;
  final List<MedicalConditionItem> medicalConditions;
  final HealthSharingConsent consent;
  final String accountStatus; // 'ACTIVE' | 'PENDING_VERIFICATION' | etc.
  final String updatedAt;
  final int version;

  factory HealthProfile.fromJson(Map<String, dynamic> json) {
    final allergiesJson = json['allergies'];
    final conditionsJson = json['medicalConditions'];
    final consentJson = json['consent'];

    return HealthProfile(
      id: json['id'] as String? ?? '',
      camperId: json['camperId'] as String? ?? '',
      camperName: json['camperName'] as String? ?? '',
      bloodType: json['bloodType'] as String? ?? 'UNKNOWN',
      physicalFitnessLevel: json['physicalFitnessLevel'] as String? ?? 'BEGINNER',
      dietaryRestrictions: json['dietaryRestrictions'] as String? ?? '',
      emergencyNotes: json['emergencyNotes'] as String? ?? '',
      allergies: allergiesJson is List
          ? allergiesJson
                .whereType<Map<String, dynamic>>()
                .map(AllergyItem.fromJson)
                .toList()
          : const [],
      medicalConditions: conditionsJson is List
          ? conditionsJson
                .whereType<Map<String, dynamic>>()
                .map(MedicalConditionItem.fromJson)
                .toList()
          : const [],
      consent: consentJson is Map<String, dynamic>
          ? HealthSharingConsent.fromJson(consentJson)
          : const HealthSharingConsent(isConsentGranted: false, allowedRoles: []),
      accountStatus: json['accountStatus'] as String? ?? 'ACTIVE',
      updatedAt: json['updatedAt'] as String? ?? '',
      version: json['version'] as int? ?? 1,
    );
  }
}

class UpdateHealthProfileInput {
  const UpdateHealthProfileInput({
    required this.bloodType,
    required this.physicalFitnessLevel,
    this.dietaryRestrictions,
    this.emergencyNotes,
    required this.allergies,
    required this.medicalConditions,
    required this.isConsentGranted,
  });

  final String bloodType;
  final String physicalFitnessLevel;
  final String? dietaryRestrictions;
  final String? emergencyNotes;
  final List<AllergyItem> allergies;
  final List<MedicalConditionItem> medicalConditions;
  final bool isConsentGranted;

  Map<String, dynamic> toJson() => {
    'bloodType': bloodType,
    'physicalFitnessLevel': physicalFitnessLevel,
    if (dietaryRestrictions != null) 'dietaryRestrictions': dietaryRestrictions,
    if (emergencyNotes != null) 'emergencyNotes': emergencyNotes,
    'allergies': allergies.map((e) => e.toJson()).toList(),
    'medicalConditions': medicalConditions.map((e) => e.toJson()).toList(),
    'isConsentGranted': isConsentGranted,
  };
}
