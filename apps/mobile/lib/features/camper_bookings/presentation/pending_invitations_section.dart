import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../trip_reviews/presentation/review_bookings_tab.dart';
import '../data/booking_invitations_api.dart';
import '../domain/camper_booking_models.dart';
import 'camper_booking_format.dart';

class PendingInvitationsSection extends ConsumerStatefulWidget {
  const PendingInvitationsSection({super.key});

  @override
  ConsumerState<PendingInvitationsSection> createState() => _PendingInvitationsSectionState();
}

class _PendingInvitationsSectionState extends ConsumerState<PendingInvitationsSection> {
  String? _respondingId;

  Future<void> _respond(MyPendingBookingInvitation invitation, {required bool accept}) async {
    setState(() => _respondingId = invitation.id);
    try {
      final api = ref.read(bookingInvitationsApiProvider);
      if (accept) {
        await api.acceptBookingInvitation(invitation.token);
      } else {
        await api.declineBookingInvitation(invitation.token);
      }
      ref.invalidate(myPendingInvitationsProvider);
      ref.invalidate(reviewBookingsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            accept
                ? 'Bạn đã tham gia chuyến đi "${invitation.tripTitle}".'
                : 'Đã từ chối lời mời tham gia chuyến đi.',
          ),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(bookingErrorText(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _respondingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(myPendingInvitationsProvider);
    final invitations = query.valueOrNull;
    if (invitations == null || invitations.isEmpty) {
      return const SizedBox.shrink();
    }

    final fmt = DateFormat('dd/MM/yyyy HH:mm');
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: CtmsSectionCard(
        title: 'Lời mời tham gia chuyến đi (${invitations.length})',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Xác nhận tham gia để mở đầy đủ điểm danh, tải bản đồ ngoại tuyến và theo dõi GPS.',
              style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.md),
            for (final inv in invitations) ...[
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(inv.tripTitle, style: AppTypography.bodyStrong),
                    if (inv.routeName != null && inv.routeName!.isNotEmpty)
                      Text(
                        inv.routeName!,
                        style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                      ),
                    if (inv.tripStartsAt != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Khởi hành: ${fmt.format(inv.tripStartsAt!.toLocal())}',
                        style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                    Text(
                      'Người mời: ${inv.inviterName}',
                      style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _respondingId != null
                                ? null
                                : () => _respond(inv, accept: false),
                            child: const Text('Từ chối'),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: CtmsButton(
                            label: 'Chấp nhận',
                            isLoading: _respondingId == inv.id,
                            onPressed: _respondingId != null
                                ? null
                                : () => _respond(inv, accept: true),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
