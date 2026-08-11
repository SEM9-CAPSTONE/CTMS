import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/camper_health_profile_repository.dart';
import '../domain/health_profile.dart';

class CamperHealthProfileController extends AsyncNotifier<HealthProfile?> {
  bool _isSaving = false;

  bool get isSaving => _isSaving;

  @override
  Future<HealthProfile?> build() {
    return ref.watch(camperHealthProfileRepositoryProvider).getProfile();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(camperHealthProfileRepositoryProvider).getProfile());
  }

  Future<bool> save(UpdateHealthProfileInput input, int version) async {
    if (_isSaving) return false;
    _isSaving = true;

    final result = await AsyncValue.guard(
      () => ref.read(camperHealthProfileRepositoryProvider).updateProfile(input, version),
    );
    state = result;
    _isSaving = false;

    return result.hasValue;
  }

  Future<bool> toggleConsent(bool grant) async {
    if (_isSaving) return false;
    _isSaving = true;

    final result = await AsyncValue.guard(() {
      if (grant) {
        return ref.read(camperHealthProfileRepositoryProvider).grantConsent();
      } else {
        return ref.read(camperHealthProfileRepositoryProvider).revokeConsent();
      }
    });

    state = result;
    _isSaving = false;
    return result.hasValue;
  }
}

final camperHealthProfileControllerProvider =
    AsyncNotifierProvider<CamperHealthProfileController, HealthProfile?>(
      CamperHealthProfileController.new,
    );
