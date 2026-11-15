import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'survival_local_model_native.dart'
    if (dart.library.js_interop) 'survival_local_model_web.dart';

export 'survival_local_model_native.dart'
    if (dart.library.js_interop) 'survival_local_model_web.dart';
export 'survival_model_store.dart' show LocalModelFailure, survivalModelRelease;

final survivalLocalModelProvider = Provider<SurvivalLocalModel>(
  (ref) => SurvivalLocalModel(
    enabled: const bool.fromEnvironment('CTMS_ENABLE_LOCAL_AI'),
  ),
);

final survivalLocalModelReadyProvider = FutureProvider.autoDispose<bool>(
  (ref) => ref.watch(survivalLocalModelProvider).latestReady(),
);
