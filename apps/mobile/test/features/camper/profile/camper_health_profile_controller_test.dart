import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/features/camper/profile/application/camper_health_profile_controller.dart';
import 'package:mobile/features/camper/profile/data/camper_health_profile_repository.dart';
import 'package:mobile/features/camper/profile/domain/health_profile.dart';

const _healthProfile = HealthProfile(
  id: 'hp-123',
  camperId: 'user-1',
  camperName: 'Nguyen Van B',
  bloodType: 'O+',
  physicalFitnessLevel: 'INTERMEDIATE',
  dietaryRestrictions: 'No seafood',
  emergencyNotes: 'EpiPen required',
  allergies: [
    AllergyItem(id: 'alg-1', name: 'Peanuts', severity: 'HIGH', reaction: 'Hives'),
  ],
  medicalConditions: [
    MedicalConditionItem(id: 'med-1', name: 'Mild Asthma', medication: 'Inhaler'),
  ],
  consent: HealthSharingConsent(
    isConsentGranted: false,
    allowedRoles: ['HOST', 'PORTER'],
  ),
  accountStatus: 'ACTIVE',
  updatedAt: '2026-08-08T00:00:00.000Z',
  version: 1,
);

class _RecordingCamperHealthProfileRepository extends CamperHealthProfileRepository {
  _RecordingCamperHealthProfileRepository({this.failure})
      : super(ApiClient(TokenStorage(const FlutterSecureStorage())));

  final Object? failure;
  int getCallCount = 0;
  int updateCallCount = 0;
  int consentCallCount = 0;
  UpdateHealthProfileInput? lastInput;
  int? lastVersion;
  bool? lastConsentGrant;

  @override
  Future<HealthProfile> getProfile() async {
    getCallCount++;
    if (failure != null) throw failure!;
    return _healthProfile;
  }

  @override
  Future<HealthProfile> updateProfile(UpdateHealthProfileInput input, int version) async {
    updateCallCount++;
    lastInput = input;
    lastVersion = version;
    if (failure != null) throw failure!;
    return HealthProfile(
      id: _healthProfile.id,
      camperId: _healthProfile.camperId,
      camperName: _healthProfile.camperName,
      bloodType: input.bloodType,
      physicalFitnessLevel: input.physicalFitnessLevel,
      dietaryRestrictions: input.dietaryRestrictions ?? '',
      emergencyNotes: input.emergencyNotes ?? '',
      allergies: input.allergies,
      medicalConditions: input.medicalConditions,
      consent: HealthSharingConsent(
        isConsentGranted: input.isConsentGranted,
        allowedRoles: _healthProfile.consent.allowedRoles,
      ),
      accountStatus: _healthProfile.accountStatus,
      updatedAt: DateTime.now().toIso8601String(),
      version: version + 1,
    );
  }

  @override
  Future<HealthProfile> grantConsent() async {
    consentCallCount++;
    lastConsentGrant = true;
    if (failure != null) throw failure!;
    return HealthProfile(
      id: _healthProfile.id,
      camperId: _healthProfile.camperId,
      camperName: _healthProfile.camperName,
      bloodType: _healthProfile.bloodType,
      physicalFitnessLevel: _healthProfile.physicalFitnessLevel,
      dietaryRestrictions: _healthProfile.dietaryRestrictions,
      emergencyNotes: _healthProfile.emergencyNotes,
      allergies: _healthProfile.allergies,
      medicalConditions: _healthProfile.medicalConditions,
      consent: const HealthSharingConsent(
        isConsentGranted: true,
        allowedRoles: ['HOST', 'PORTER'],
      ),
      accountStatus: _healthProfile.accountStatus,
      updatedAt: DateTime.now().toIso8601String(),
      version: _healthProfile.version + 1,
    );
  }

  @override
  Future<HealthProfile> revokeConsent() async {
    consentCallCount++;
    lastConsentGrant = false;
    if (failure != null) throw failure!;
    return HealthProfile(
      id: _healthProfile.id,
      camperId: _healthProfile.camperId,
      camperName: _healthProfile.camperName,
      bloodType: _healthProfile.bloodType,
      physicalFitnessLevel: _healthProfile.physicalFitnessLevel,
      dietaryRestrictions: _healthProfile.dietaryRestrictions,
      emergencyNotes: _healthProfile.emergencyNotes,
      allergies: _healthProfile.allergies,
      medicalConditions: _healthProfile.medicalConditions,
      consent: const HealthSharingConsent(
        isConsentGranted: false,
        allowedRoles: ['HOST', 'PORTER'],
      ),
      accountStatus: _healthProfile.accountStatus,
      updatedAt: DateTime.now().toIso8601String(),
      version: _healthProfile.version + 1,
    );
  }
}

void main() {
  group('CamperHealthProfileController', () {
    test('loads current health profile and consent settings', () async {
      final repository = _RecordingCamperHealthProfileRepository();
      final container = ProviderContainer(
        overrides: [camperHealthProfileRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      final profile = await container.read(camperHealthProfileControllerProvider.future);

      expect(profile?.bloodType, 'O+');
      expect(profile?.allergies.single.name, 'Peanuts');
      expect(profile?.consent.isConsentGranted, isFalse);
      expect(repository.getCallCount, 1);
    });

    test('updates health profile fields through update API', () async {
      final repository = _RecordingCamperHealthProfileRepository();
      final container = ProviderContainer(
        overrides: [camperHealthProfileRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      await container.read(camperHealthProfileControllerProvider.future);

      final input = UpdateHealthProfileInput(
        bloodType: 'AB-',
        physicalFitnessLevel: 'EXPERT',
        dietaryRestrictions: 'Vegan',
        emergencyNotes: 'None',
        allergies: const [],
        medicalConditions: const [],
        isConsentGranted: true,
      );

      final success = await container
          .read(camperHealthProfileControllerProvider.notifier)
          .save(input, 1);

      expect(success, isTrue);
      expect(repository.updateCallCount, 1);
      expect(repository.lastInput?.bloodType, 'AB-');
      expect(repository.lastVersion, 1);
      expect(container.read(camperHealthProfileControllerProvider).value?.version, 2);
    });

    test('toggles consent correctly', () async {
      final repository = _RecordingCamperHealthProfileRepository();
      final container = ProviderContainer(
        overrides: [camperHealthProfileRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      await container.read(camperHealthProfileControllerProvider.future);

      final successGrant = await container
          .read(camperHealthProfileControllerProvider.notifier)
          .toggleConsent(true);

      expect(successGrant, isTrue);
      expect(repository.consentCallCount, 1);
      expect(repository.lastConsentGrant, isTrue);
      expect(container.read(camperHealthProfileControllerProvider).value?.consent.isConsentGranted, isTrue);
    });
  });
}
