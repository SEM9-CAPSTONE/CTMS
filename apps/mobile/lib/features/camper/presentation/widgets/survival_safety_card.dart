import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../offline_packages/application/offline_trip_providers.dart';
import '../../../sos/data/sos_api.dart';
import '../../../sos/data/sos_store.dart';
import '../../../sos/domain/sos_alert.dart';
import '../../../sos/presentation/trigger_sos_dialog.dart';
import '../../../sync/application/connectivity_source.dart';
import '../../../trip_reviews/data/reviews_api.dart';
import '../../../trip_reviews/domain/review_models.dart';
import '../../application/survival_chat_controller.dart';
import '../../data/emergency_safety_engine.dart';
import '../../data/emergency_sos_status.dart';

final _connectivity = StreamProvider.autoDispose<bool>((ref) async* {
  final source = ref.watch(connectivitySourceProvider);
  yield await source.isConnected();
  yield* source.onConnectivityChanged;
});

typedef _SosContext = ({bool eligible, String? delivery});

final _sosContext = FutureProvider.autoDispose
    .family<_SosContext, OfflineTripSelection>((ref, trip) async {
      if (ref.watch(survivalChatAccountProvider) != trip.accountId) {
        return (eligible: false, delivery: null);
      }
      final store = ref.watch(sosStoreProvider);
      final api = ref.watch(sosApiProvider);
      final connection = ref.watch(_connectivity).valueOrNull;
      final snapshot = connection == false
          ? ref.watch(survivalChatSnapshotProvider(trip))
          : null;
      final local = await store
          .read(trip.tripId)
          .catchError((_) => <LocalSosAlert>[]);
      final owned = local.where((item) => item.senderId == trip.accountId);

      if (connection == true) {
        try {
          final server = await api.list(trip.tripId);
          return (
            eligible: true,
            delivery: emergencySosStatus(
              owned,
              server.where((item) => item.senderId == trip.accountId),
            ),
          );
        } catch (_) {
          return (
            eligible: false,
            delivery: emergencySosStatus(owned, const []),
          );
        }
      }
      // The saved package reader verifies the current account and active version.
      // Without that local evidence, the existing SOS entries remain available.
      return (
        eligible: await snapshot?.catchError((_) => null) != null,
        delivery: emergencySosStatus(owned, const []),
      );
    });

class SurvivalSafetyCard extends ConsumerWidget {
  const SurvivalSafetyCard({
    super.key,
    required this.assessment,
    required this.trip,
    required this.showActions,
    required this.showLocation,
  });

  final EmergencyAssessment assessment;
  final OfflineTripSelection? trip;
  final bool showActions;
  final VoidCallback showLocation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final urgent = assessment.severity == EmergencySeverity.emergency;
    final protocol = approvedEmergencyProtocol(assessment.protocolId);
    final clarification = emergencyClarification(assessment.clarificationId);
    final connection = urgent && showActions
        ? ref.watch(_connectivity).valueOrNull
        : null;
    final selection = trip;
    final sos = urgent && showActions && selection != null
        ? ref.watch(_sosContext(selection)).valueOrNull
        : null;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: AppSpacing.md),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: urgent ? AppColors.statusDangerBg : AppColors.statusWarningBg,
          border: Border.all(
            color: urgent
                ? AppColors.statusDanger
                : AppColors.statusWarningBorder,
          ),
          borderRadius: AppRadius.cardBorderRadius,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  urgent
                      ? Icons.emergency_outlined
                      : Icons.warning_amber_rounded,
                  color: urgent
                      ? AppColors.statusDanger
                      : AppColors.statusWarning,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(
                      urgent ? 'Có dấu hiệu khẩn cấp' : 'Cần làm rõ tình huống',
                      style: AppTypography.bodyStrong,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            if (protocol != null) ...[
              Text(protocol.title, style: AppTypography.bodyStrong),
              for (final line in [...protocol.guidance, ...protocol.warnings])
                Text(line, style: AppTypography.body),
            ] else
              const Text(
                'Chưa có hướng dẫn đã được thẩm định cho tình huống này.',
                style: AppTypography.body,
              ),
            if (!urgent &&
                assessment.completeness != AssessmentCompleteness.sufficient)
              const Text('Chưa đủ thông tin để đánh giá mức độ nguy hiểm.'),
            if (clarification != null) Text(clarification),
            if (urgent && showActions) ...[
              if (connection == false)
                const Text(
                  'Thiết bị đang ngoại tuyến. Chưa thể gửi yêu cầu cứu hộ mới.',
                )
              else if (connection == true)
                const Text('Thiết bị có kết nối mạng.'),
              if (sos?.delivery case final delivery?)
                Text(
                  connection == false
                      ? 'Ghi nhận gần nhất: $delivery'
                      : delivery,
                ),
              Wrap(
                spacing: AppSpacing.sm,
                children: [
                  if (sos?.eligible == true && selection != null)
                    TextButton.icon(
                      icon: const Icon(Icons.sos_rounded),
                      label: const Text('Mở xác nhận SOS'),
                      onPressed: () async {
                        await TriggerSosDialog.show(
                          context,
                          tripId: selection.tripId,
                        );
                        if (context.mounted) {
                          ref.invalidate(_sosContext(selection));
                        }
                      },
                    )
                  else if (connection == true && selection == null)
                    TextButton(
                      onPressed: () async {
                        final account = ref.read(survivalChatAccountProvider);
                        final tripId = await showDialog<String>(
                          context: context,
                          builder: (_) => const _SosTripSelector(),
                        );
                        if (context.mounted &&
                            account != null &&
                            ref.read(survivalChatAccountProvider) == account &&
                            tripId != null) {
                          await TriggerSosDialog.show(context, tripId: tripId);
                        }
                      },
                      child: const Text('Chọn chuyến đi để mở SOS'),
                    )
                  else if (GoRouter.maybeOf(context) != null)
                    TextButton(
                      onPressed: () => context.go('/camper/trips'),
                      child: const Text('Mở chuyến đi của tôi'),
                    ),
                  TextButton(
                    onPressed: showLocation,
                    child: const Text('Xem vị trí hiện tại'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SosTripSelector extends ConsumerStatefulWidget {
  const _SosTripSelector();

  @override
  ConsumerState<_SosTripSelector> createState() => _SosTripSelectorState();
}

class _SosTripSelectorState extends ConsumerState<_SosTripSelector> {
  late final Future<List<ReviewBooking>> _bookings;
  late final String? _account;
  bool _checking = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _account = ref.read(survivalChatAccountProvider);
    _bookings = ref.read(reviewsApiProvider).bookings();
  }

  Future<void> _choose(String tripId) async {
    setState(() {
      _checking = true;
      _error = null;
    });
    try {
      // The existing list endpoint enforces the same participation check as create.
      await ref.read(sosApiProvider).list(tripId);
      if (mounted && ref.read(survivalChatAccountProvider) == _account) {
        Navigator.of(context).pop(tripId);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _checking = false;
        _error = 'Chưa xác minh được quyền gửi SOS cho chuyến đi này.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final account = ref.watch(survivalChatAccountProvider);
    return AlertDialog(
      title: const Text('Chọn chuyến đi'),
      content: SizedBox(
        width: double.maxFinite,
        child: FutureBuilder(
          future: _bookings,
          builder: (context, snapshot) {
            if (account != _account) {
              return const Text('Phiên đăng nhập đã thay đổi.');
            }
            if (snapshot.hasError) {
              return const Text('Chưa tải được chuyến đi.');
            }
            if (!snapshot.hasData) return const LinearProgressIndicator();
            final bookings = <String, ReviewBooking>{
              for (final booking in snapshot.data!)
                if (booking.tripId != null &&
                    (booking.status == 'confirmed' ||
                        booking.status == 'completed'))
                  booking.tripId!: booking,
            };
            if (bookings.isEmpty) {
              return const Text('Chưa có chuyến đi phù hợp.');
            }
            return SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_checking) const LinearProgressIndicator(),
                  if (_error case final error?) Text(error),
                  for (final entry in bookings.entries)
                    ListTile(
                      title: Text(entry.value.title),
                      enabled: !_checking,
                      onTap: _checking ? null : () => _choose(entry.key),
                    ),
                ],
              ),
            );
          },
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Đóng'),
        ),
      ],
    );
  }
}
