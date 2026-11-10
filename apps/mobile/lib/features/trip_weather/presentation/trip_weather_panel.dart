import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../application/trip_weather_controller.dart';
import '../data/trip_weather_api.dart';
import 'trip_weather_labels.dart';

// CtmsSectionCard is always white, so text uses the fixed text tokens like its title.
final _body = AppTypography.body.copyWith(color: AppColors.textPrimary);
final _bodyStrong = AppTypography.bodyStrong.copyWith(
  color: AppColors.textPrimary,
);
final _caption = AppTypography.caption.copyWith(color: AppColors.textSecondary);

/// Value for the "THỜI TIẾT" highlight box: the real risk level once a forecast is loaded,
/// otherwise [fallback] (what the screen showed before).
String tripWeatherHighlightValue(
  TripWeatherController controller,
  String fallback,
) {
  if (!controller.loaded) return fallback;
  final forecast = controller.forecast;
  if (forecast == null || !forecast.isAvailable) {
    return weatherNoForecastShortLabel;
  }
  return weatherRiskShortLabels[forecast.riskLevel] ??
      weatherNoForecastShortLabel;
}

/// CTMS-62: forecast for the Trip's own dates (not today's weather) and the Trip's risk-change
/// notices, for the Camper. Same content as the web traveller card.
class TripWeatherPanel extends ConsumerWidget {
  const TripWeatherPanel({super.key, required this.tripId, this.bookingId});

  final String tripId;
  final String? bookingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(
      tripWeatherControllerProvider((tripId: tripId, bookingId: bookingId)),
    );
    final forecast = controller.forecast;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: CtmsSectionCard(
        key: const Key('trip-weather-panel'),
        title: 'Dự báo thời tiết ngày đi',
        trailing: forecast != null && forecast.isAvailable
            ? CtmsStatusBadge(
                key: const Key('trip-weather-risk'),
                label: weatherRiskLabel(forecast.riskLevel),
                status: weatherRiskStatus(forecast.riskLevel),
              )
            : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!controller.loaded)
              Text(
                'Đang tải dự báo thời tiết…',
                key: const Key('trip-weather-loading'),
                style: _caption,
              )
            else if (forecast == null)
              _ForecastError(
                message:
                    controller.forecastError ??
                    'Không tải được dự báo thời tiết. Vui lòng thử lại.',
                onRetry: controller.refresh,
              )
            else ...[
              _ForecastBody(forecast: forecast, now: controller.now),
              if (controller.forecastError != null)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.sm),
                  child: Text(
                    'Không cập nhật được, đang hiển thị dự báo đã tải trước đó.',
                    key: const Key('trip-weather-stale'),
                    style: _caption,
                  ),
                ),
            ],
            if (controller.notices.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              const Divider(height: 1, color: AppColors.border),
              const SizedBox(height: AppSpacing.md),
              Text('Thay đổi dự báo', style: _bodyStrong),
              const SizedBox(height: AppSpacing.xs),
              for (final notice in controller.notices.take(5))
                _NoticeRow(
                  notice: notice,
                  onTap: () => controller.markNoticeRead(notice),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ForecastError extends StatelessWidget {
  const _ForecastError({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(message, key: const Key('trip-weather-error'), style: _body),
        const SizedBox(height: AppSpacing.sm),
        CtmsButton(
          label: 'Thử lại',
          variant: CtmsButtonVariant.soft,
          onPressed: () => onRetry(),
        ),
      ],
    );
  }
}

class _ForecastBody extends StatelessWidget {
  const _ForecastBody({required this.forecast, required this.now});

  final TripWeatherForecast forecast;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final schedule =
        '${formatWeatherTime(forecast.tripStartsAt)} – ${formatWeatherTime(forecast.tripEndsAt)}';
    if (!forecast.isAvailable) {
      return Text(
        forecast.status == 'out_of_range'
            ? 'Ngày đi còn xa hơn ${forecast.horizonDays} ngày nên chưa có dự báo. Dự báo sẽ có khi gần ngày khởi hành; hệ thống không dùng thời tiết hôm nay để thay thế.'
            : 'Chưa có dự báo thời tiết cho ngày đi.',
        key: const Key('trip-weather-empty'),
        style: _body,
      );
    }
    final reliability = forecastReliability(forecast.tripStartsAt, now);
    final worst = forecast.worstReading;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Dự báo cho lịch trình $schedule, lấy giờ xấu nhất của từng tiêu chí.',
          style: _caption,
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            CtmsStatusBadge(
              key: const Key('trip-weather-reliability'),
              label: reliability.label,
              status: reliability.status,
            ),
            if (forecast.checkedAt != null)
              Text(
                'Kiểm tra lần cuối: ${formatWeatherTime(forecast.checkedAt!)}',
                style: _caption,
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(reliability.description, style: _caption),
        if (!forecast.coversWholeTrip && forecast.forecastTo != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Dự báo mới phủ tới ${formatWeatherTime(forecast.forecastTo!)}; phần còn lại của chuyến đi chưa có dữ liệu dự báo.',
            key: const Key('trip-weather-partial'),
            style: _caption.copyWith(color: AppColors.statusWarning),
          ),
        ],
        if (worst != null) ...[
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.lg,
            runSpacing: AppSpacing.sm,
            children: [
              _Reading(
                label: 'Lượng mưa',
                value: formatRainfall(worst.rainfallMm),
              ),
              _Reading(label: 'Sức gió', value: formatWind(worst.windKph)),
              _Reading(
                label: 'Nhiệt độ',
                value: formatTemperature(worst.temperatureC),
              ),
              _Reading(
                label: 'Tầm nhìn',
                value: formatVisibility(worst.visibilityM),
              ),
              _Reading(
                label: 'Dông sét',
                value: worst.thunderstorm ? 'Có' : 'Không',
              ),
            ],
          ),
        ],
        if (forecast.adviceText != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            forecast.adviceText!,
            key: const Key('trip-weather-advice'),
            style: _body,
          ),
          for (final action in forecast.adviceActions)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text('• $action', style: _body),
            ),
        ],
      ],
    );
  }
}

class _Reading extends StatelessWidget {
  const _Reading({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: _caption),
        Text(value, style: _bodyStrong),
      ],
    );
  }
}

class _NoticeRow extends StatelessWidget {
  const _NoticeRow({required this.notice, required this.onTap});

  final WeatherChangeNotice notice;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      key: Key('trip-weather-notice-${notice.id}'),
      onTap: notice.isUnread ? onTap : null,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 6, right: AppSpacing.sm),
              child: Container(
                key: notice.isUnread
                    ? Key('trip-weather-notice-unread-${notice.id}')
                    : null,
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: notice.isUnread
                      ? (notice.worsened
                            ? AppColors.statusDanger
                            : AppColors.statusInfo)
                      : Colors.transparent,
                ),
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notice.message,
                    style: notice.isUnread ? _bodyStrong : _body,
                  ),
                  const SizedBox(height: 2),
                  Text(formatWeatherTime(notice.createdAt), style: _caption),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
