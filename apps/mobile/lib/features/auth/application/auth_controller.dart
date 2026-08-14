import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_repository.dart';
import '../domain/auth_user.dart';

class AuthController extends AsyncNotifier<AuthUser?> {

  bool _isLoggingIn = false;

  @override
  Future<AuthUser?> build() {
    return ref.watch(authRepositoryProvider).tryRestoreSession();
  }

  Future<void> login({required String identifier, required String password}) async {
    if (_isLoggingIn) return;
    _isLoggingIn = true;

    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(authRepositoryProvider).login(identifier: identifier, password: password),
    );

    _isLoggingIn = false;
  }

  bool _isLoggingOut = false;

  Future<void> logout({bool allDevices = false}) async {
    if (_isLoggingOut) return;

    _isLoggingOut = true;

    try {
      await ref.read(authRepositoryProvider).logout(
        allDevices: allDevices,
      );

      state = const AsyncData(null);
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    } finally {
      _isLoggingOut = false;
    }
  }

  
  void setSession(AuthUser user) => state = AsyncData(user);
}

final authControllerProvider = AsyncNotifierProvider<AuthController, AuthUser?>(
  AuthController.new,
);
