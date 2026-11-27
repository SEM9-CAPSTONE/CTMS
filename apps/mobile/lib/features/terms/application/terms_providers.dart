import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/application/auth_controller.dart';
import '../data/terms_api.dart';
import '../domain/terms_models.dart';

final currentTermsProvider = FutureProvider<TermsVersionDetail>((ref) {
  return ref.watch(termsApiProvider).getCurrent();
});

final termsVersionsProvider = FutureProvider<List<TermsVersionSummary>>((ref) {
  return ref.watch(termsApiProvider).listVersions();
});

final termsVersionByCodeProvider =
    FutureProvider.family<TermsVersionDetail, String>((ref, version) {
      return ref.watch(termsApiProvider).getVersionByCode(version);
    });

final myTermsStatusProvider = FutureProvider<MyTermsStatus?>((ref) async {
  final user = ref.watch(authControllerProvider).valueOrNull;
  if (user == null) return null;
  try {
    return await ref.watch(termsApiProvider).getMyStatus();
  } catch (_) {
    return null;
  }
});

/// Keys formatted as `$userId:$version` deferred via "Để sau" during this app
/// session. Never modifies server-side acceptance history.
final deferredTermsVersionsProvider = StateProvider<Set<String>>(
  (ref) => <String>{},
);
