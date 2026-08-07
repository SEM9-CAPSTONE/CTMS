import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class CtmsApp extends ConsumerWidget {
  const CtmsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'CTMS',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      routerConfig: router,
      // Required for RestorationMixin anywhere in the tree (e.g.
      // RegisterScreen) to actually persist/restore state across the app
      // being backgrounded and the OS reclaiming the process.
      restorationScopeId: 'ctms',
    );
  }
}
