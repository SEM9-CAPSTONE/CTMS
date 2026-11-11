import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/camper_profile_repository.dart';
import '../domain/camper_profile.dart';

class CamperProfileController extends AsyncNotifier<CamperProfile?> {
  bool _isSaving = false;

  bool get isSaving => _isSaving;

  @override
  Future<CamperProfile?> build() {
    return ref.watch(camperProfileRepositoryProvider).getProfile();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(camperProfileRepositoryProvider).getProfile());
  }

  Future<bool> save(UpdateCamperProfileInput input) async {
    if (_isSaving) return false;
    _isSaving = true;

    final result = await AsyncValue.guard(
      () => ref.read(camperProfileRepositoryProvider).updateProfile(input),
    );
    state = result;
    _isSaving = false;

    return result.hasValue;
  }
}

final camperProfileControllerProvider =
    AsyncNotifierProvider<CamperProfileController, CamperProfile?>(
      CamperProfileController.new,
    );
