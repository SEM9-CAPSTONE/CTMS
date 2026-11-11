import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/camper_overview_repository.dart';
import '../domain/camper_overview_models.dart';

part 'camper_overview_controller.g.dart';

/// `AsyncValue<CamperOverviewSnapshot>` for the Camper "Tổng quan" screen.
/// Code-generated (unlike the hand-rolled `Notifier`s in `features/auth`)
/// — a plain read-only fetch doesn't need any mutating methods, so the
/// `@riverpod` function form is the leaner fit here.
@riverpod
Future<CamperOverviewSnapshot> camperOverview(CamperOverviewRef ref) {
  return ref.watch(camperOverviewRepositoryProvider).fetchOverview();
}
