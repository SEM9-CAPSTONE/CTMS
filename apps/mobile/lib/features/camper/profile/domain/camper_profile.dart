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

  factory CamperProfile.fromJson(Map<String, dynamic> json) {
    final contacts = json['emergencyContacts'];
    return CamperProfile(
      id: json['id'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      fullName: json['fullName'] as String? ?? '',
      dateOfBirth: json['dateOfBirth'] as String? ?? '',
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

  Map<String, dynamic> toJson() => {
    'fullName': fullName,
    'dateOfBirth': dateOfBirth,
    'gender': gender,
    'address': address,
    'bio': bio,
    'emergencyContacts': emergencyContacts.map((contact) => contact.toJson()).toList(),
  };
}
