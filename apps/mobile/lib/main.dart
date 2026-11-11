import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/api/api_client.dart';
import 'core/storage/token_storage.dart';
import 'features/auth/application/auth_controller.dart';

void main() {
  runApp(
    ProviderScope(
      overrides: [
        // CTMS-04-T03, DG-M2: the one place ApiClient is wired to
        // AuthController.clearSession(). api_client.dart itself never
        // imports auth_controller.dart -- doing so there would cycle back
        // through auth_repository.dart -> auth_api.dart -> api_client.dart.
        // main.dart is the composition root, the only file allowed to know
        // both sides; `ApiClient` still only sees a plain callback, never
        // `Ref`/`authControllerProvider` directly.
        //
        // `ref.read` (not `ref.watch`) inside the callback: it must only
        // resolve `authControllerProvider` at the moment a refresh actually
        // fails, not re-evaluate `apiClientProvider` (and rebuild the whole
        // Dio/interceptor stack) every time auth state changes.
        apiClientProvider.overrideWith(
          (ref) => ApiClient(
            ref.watch(tokenStorageProvider),
            onSessionExpired: () => ref.read(authControllerProvider.notifier).clearSession(),
          ),
        ),
      ],
      child: const CtmsApp(),
    ),
  );
}
