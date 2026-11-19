import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_exception.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/ctms_button.dart';
import '../../core/widgets/ctms_section_card.dart';
import '../auth/application/auth_controller.dart';
import '../camper/data/camper_explore_api.dart';
import '../camper/domain/published_trip.dart';
import 'reputation_summary.dart';
import 'review_reputation.dart';

bool deniedReputation(Object? error) =>
    error is ApiException && [401, 403, 404].contains(error.statusCode);

PublishedTrip? visibleTrip(AsyncValue<PublishedTrip> source, String? account) {
  if (deniedReputation(source.error)) return null;
  final trip = source.valueOrNull;
  return trip?.loadedForAccount == account ? trip : null;
}

class HostReputationPanel extends ConsumerWidget {
  const HostReputationPanel({super.key, required this.tripId});
  final String tripId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final account = ref.watch(
      authControllerProvider.select((state) => state.valueOrNull?.id),
    );
    final source = ref.watch(publishedTripDetailsProvider(tripId));
    final trip = visibleTrip(source, account);
    final denied = deniedReputation(source.error);
    if (!source.hasError && !source.isLoading && trip?.hostReputation == null) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: CtmsSectionCard(
        title: ReputationStrings.host,
        trailing: IconButton(
          tooltip: ReputationStrings.refresh,
          onPressed: source.isLoading
              ? null
              : () => ref.invalidate(publishedTripDetailsProvider(tripId)),
          icon: const Icon(Icons.refresh),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (trip?.hostReputation != null) ...[
              Text(
                trip!.hostName?.trim().isNotEmpty == true
                    ? trip.hostName!
                    : ReputationStrings.missingName,
                style: AppTypography.bodyStrong,
              ),
              const SizedBox(height: AppSpacing.sm),
              ReputationSummary(value: trip.hostReputation),
            ],
            if (source.isLoading)
              const LinearProgressIndicator(
                semanticsLabel: ReputationStrings.loading,
              ),
            if (source.hasError) ...[
              Text(
                denied
                    ? ReputationStrings.unavailable
                    : trip == null
                    ? ReputationStrings.failed
                    : ReputationStrings.stale,
              ),
              if (!denied)
                CtmsButton(
                  label: ReputationStrings.retry,
                  variant: CtmsButtonVariant.secondary,
                  onPressed: () =>
                      ref.invalidate(publishedTripDetailsProvider(tripId)),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
