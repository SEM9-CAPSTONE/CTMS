class EmergencyContact {
  const EmergencyContact({
    this.id,
    required this.name,
    required this.relationship,
    required this.phone,
    this.email,
  });

  final String? id;
  final String name;
  final String relationship;
  final String phone;
  final String? email;

  factory EmergencyContact.fromJson(Map<String, dynamic> json) {
    return EmergencyContact(
      id: json['id'] as String?,
      name: json['name'] as String? ?? '',
      relationship: json['relationship'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'relationship': relationship,
    'phone': phone,
    if (email != null && email!.trim().isNotEmpty) 'email': email!.trim(),
  };
}

class CamperProfile {
  const CamperProfile({
    required this.id,
    this.email,
    this.phone,
    required this.fullName,
    required this.dateOfBirth,
    required this.gender,
    required this.address,
    required this.bio,
    required this.emergencyContacts,
  });

  final String id;
  final String? email;
  final String? phone;
  final String fullName;
  final String dateOfBirth;
  final String gender;
  final String address;
  final String bio;
  final List<EmergencyContact> emergencyContacts;

  static String _displayDate(String? value) {
    if (value == null || value.isEmpty) return '';
    final datePart = value.split('T').first;
    final parts = datePart.split('-');
    if (parts.length != 3) return value;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }

  static String _displayName(Map<String, dynamic> json) {
    final fullName = (json['fullName'] as String?)?.trim();
    if (fullName != null && fullName.isNotEmpty) return fullName;

    final email = (json['email'] as String?)?.trim();
    final emailPrefix = email?.split('@').first.trim();
    if (emailPrefix != null && emailPrefix.isNotEmpty) return emailPrefix;

    final phone = (json['phone'] as String?)?.trim();
    if (phone != null && phone.isNotEmpty) return phone;

    return 'Người dùng';
  }

  factory CamperProfile.fromJson(Map<String, dynamic> json) {
    final contacts = json['emergencyContacts'];
    return CamperProfile(
      id: json['id'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      fullName: _displayName(json),
      dateOfBirth: _displayDate(json['dateOfBirth'] as String?),
      gender: json['gender'] as String? ?? 'male',
      address: json['address'] as String? ?? '',
      bio: json['bio'] as String? ?? '',
      emergencyContacts: contacts is List
          ? contacts
                .whereType<Map<String, dynamic>>()
                .map(EmergencyContact.fromJson)
                .toList(growable: false)
          : const [],
    );
  }
}

class UpdateCamperProfileInput {
  const UpdateCamperProfileInput({
    required this.fullName,
    required this.dateOfBirth,
    required this.gender,
    required this.address,
    required this.bio,
    required this.emergencyContacts,
  });

  final String fullName;
  final String dateOfBirth;
  final String gender;
  final String address;
  final String bio;
  final List<EmergencyContact> emergencyContacts;

  static String _apiDate(String value) {
    final match = RegExp(r'^(\d{2})/(\d{2})/(\d{4})$').firstMatch(value);
    if (match == null) return value;
    return '${match.group(3)}-${match.group(2)}-${match.group(1)}';
  }

  Map<String, dynamic> toJson() => {
    'fullName': fullName,
    'dateOfBirth': _apiDate(dateOfBirth),
    'gender': gender,
    'address': address,
    'bio': bio,
    'emergencyContacts': emergencyContacts
        .map((contact) => contact.toJson())
        .toList(),
  };
}
