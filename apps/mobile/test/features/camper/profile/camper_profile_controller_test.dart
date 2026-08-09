import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/features/camper/profile/application/camper_profile_controller.dart';
import 'package:mobile/features/camper/profile/data/camper_profile_repository.dart';
import 'package:mobile/features/camper/profile/domain/camper_profile.dart';

const _profile = CamperProfile(
  id: 'user-1',
  email: 'camper@example.com',
  phone: '+84912345678',
  fullName: 'Nguyen Van B',
  dateOfBirth: '1995-04-12',
  gender: 'male',
  address: 'Da Lat, Lam Dong',
  bio: 'Weekend trekker',
  emergencyContacts: [
    EmergencyContact(
      id: 'contact-1',
      name: 'Tran Thi C',
      relationship: 'mother',
      phone: '+84911111111',
      email: 'mom@example.com',
    ),
  ],
);

class _RecordingCamperProfileRepository extends CamperProfileRepository {
  _RecordingCamperProfileRepository({this.failure})
    : super(ApiClient(TokenStorage(const FlutterSecureStorage())));

  final Object? failure;
  int getCallCount = 0;
  int updateCallCount = 0;
  UpdateCamperProfileInput? lastInput;

  @override
  Future<CamperProfile> getProfile() async {
    getCallCount++;
    if (failure != null) throw failure!;
    return _profile;
  }

  @override
  Future<CamperProfile> updateProfile(UpdateCamperProfileInput input) async {
    updateCallCount++;
    lastInput = input;
    if (failure != null) throw failure!;
    return CamperProfile(
      id: _profile.id,
      email: _profile.email,
      phone: _profile.phone,
      fullName: input.fullName,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      address: input.address,
      bio: input.bio,
      emergencyContacts: input.emergencyContacts,
    );
  }
}

void main() {
  group('CamperProfileController', () {
    test('loads current profile and emergency-contact data', () async {
      final repository = _RecordingCamperProfileRepository();
      final container = ProviderContainer(
        overrides: [camperProfileRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      final profile = await container.read(camperProfileControllerProvider.future);

      expect(profile?.fullName, 'Nguyen Van B');
      expect(profile?.emergencyContacts.single.phone, '+84911111111');
      expect(repository.getCallCount, 1);
    });

    test('updates profile through the API contract payload', () async {
      final repository = _RecordingCamperProfileRepository();
      final container = ProviderContainer(
        overrides: [camperProfileRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      await container.read(camperProfileControllerProvider.future);

      final input = UpdateCamperProfileInput(
        fullName: 'Nguyen Van C',
        dateOfBirth: '1995-04-12',
        gender: 'female',
        address: 'Sa Pa, Lao Cai',
        bio: 'Updated',
        emergencyContacts: const [
          EmergencyContact(name: 'Le Van D', relationship: 'brother', phone: '0922222222'),
        ],
      );

      final success = await container.read(camperProfileControllerProvider.notifier).save(input);

      expect(success, isTrue);
      expect(repository.updateCallCount, 1);
      expect(repository.lastInput?.fullName, 'Nguyen Van C');
      expect(container.read(camperProfileControllerProvider).value?.address, 'Sa Pa, Lao Cai');
    });

    test('a second concurrent save is ignored', () async {
      final repository = _RecordingCamperProfileRepository();
      final container = ProviderContainer(
        overrides: [camperProfileRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      await container.read(camperProfileControllerProvider.future);

      final input = UpdateCamperProfileInput(
        fullName: 'Nguyen Van C',
        dateOfBirth: '1995-04-12',
        gender: 'male',
        address: 'Sa Pa, Lao Cai',
        bio: '',
        emergencyContacts: const [],
      );

      await Future.wait([
        container.read(camperProfileControllerProvider.notifier).save(input),
        container.read(camperProfileControllerProvider.notifier).save(input),
      ]);

      expect(repository.updateCallCount, 1);
    });
  });
}
