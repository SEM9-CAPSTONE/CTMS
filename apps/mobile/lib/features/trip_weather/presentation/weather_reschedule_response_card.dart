import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../application/trip_weather_controller.dart';
import 'trip_weather_labels.dart';

/// CTMS-62: after a weather reschedule the Camper keeps the new date or cancels with a 100% refund
/// (policy §5). Shown only when the Booking API flags a weather reschedule (CTMS-58).
class WeatherRescheduleResponseCard extends ConsumerWidget {
  const WeatherRescheduleResponseCard({
    super.key,
    required this.tripId,
    required this.bookingId,
  });

  final String tripId;
  final String? bookingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (bookingId == null) return const SizedBox.shrink();
    final controller = ref.watch(
      tripWeatherControllerProvider((tripId: tripId, bookingId: bookingId)),
    );
    if (!controller.showRescheduleAnswer) return const SizedBox.shrink();

    final answered = controller.answeredStatus;
    if (answered != null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        child: CtmsAlertBanner(
          key: const Key('weather-reschedule-answered'),
          severity: CtmsAlertSeverity.info,
          icon: Icons.check_circle_outline,
          title: 'Đã ghi nhận lựa chọn của bạn',
          message: answered == 'confirmed'
              ? 'Bạn đã giữ chỗ ở lịch mới.'
              : 'Đã huỷ đơn đặt chỗ. Khoản hoàn 100% đang được xử lý.',
        ),
      );
    }

    final booking = controller.booking!;
    final start = booking.tripStartsAt;
    final end = booking.tripEndsAt;
    final schedule = start != null && end != null
        ? 'Lịch mới: ${formatWeatherTime(start)} – ${formatWeatherTime(end)}. '
        : '';
    final busy = controller.answering;

    Future<void> ask(bool accept) async {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          key: const Key('weather-reschedule-confirm'),
          title: Text(
            accept ? 'Giữ chỗ ở lịch mới?' : 'Huỷ và nhận hoàn 100%?',
          ),
          content: Text(
            accept
                ? 'Đơn đặt chỗ sẽ được xác nhận cho lịch ${start != null ? formatWeatherTime(start) : 'mới'}.'
                : 'Đơn đặt chỗ sẽ bị huỷ và bạn được hoàn toàn bộ số tiền đã thanh toán.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Quay lại'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Xác nhận'),
            ),
          ],
        ),
      );
      if (confirmed == true) await controller.answerReschedule(accept: accept);
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        key: const Key('weather-reschedule-response-card'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CtmsAlertBanner(
            severity: CtmsAlertSeverity.warning,
            icon: Icons.event_repeat_outlined,
            title: 'Trip đã dời lịch vì thời tiết',
            message:
                '${schedule}Bạn có thể giữ chỗ ở lịch mới hoặc huỷ và được hoàn 100%.',
            actions: [
              CtmsButton(
                key: const Key('weather-reschedule-keep'),
                label: 'Giữ chỗ ở lịch mới',
                isLoading: busy,
                onPressed: busy ? null : () => ask(true),
              ),
              CtmsButton(
                key: const Key('weather-reschedule-decline'),
                label: 'Huỷ và hoàn 100%',
                variant: CtmsButtonVariant.danger,
                onPressed: busy ? null : () => ask(false),
              ),
            ],
          ),
          if (controller.answerError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            CtmsAlertBanner(
              key: const Key('weather-reschedule-error'),
              severity: CtmsAlertSeverity.danger,
              title: 'Chưa gửi được lựa chọn',
              message: controller.answerError!,
            ),
          ],
        ],
      ),
    );
  }
}
