import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/camper_overview_models.dart';
import 'camper_overview_mock.dart';

/// Backs `camperOverviewProvider` — swap [fetchOverview]'s body for a real
/// `ApiClient` call once the backend exposes it; the controller and every
/// widget on the screen only depend on this interface.
class CamperOverviewRepository {
  const CamperOverviewRepository();

  Future<CamperOverviewSnapshot> fetchOverview() async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    // TODO(api): GET /campers/me/overview (or equivalent) once it exists.
    return mockCamperOverviewSnapshot;
  }
}

final camperOverviewRepositoryProvider = Provider<CamperOverviewRepository>((ref) {
  return const CamperOverviewRepository();
});
