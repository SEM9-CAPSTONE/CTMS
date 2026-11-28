import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../data/booking_invitations_api.dart';
import '../domain/camper_booking_models.dart';
import 'camper_booking_format.dart';

class BookingMembersCard extends ConsumerStatefulWidget {
  const BookingMembersCard({super.key, required this.bookingId});

  final String bookingId;

  @override
  ConsumerState<BookingMembersCard> createState() => _BookingMembersCardState();
}

class _BookingMembersCardState extends ConsumerState<BookingMembersCard> {
  final _emailController = TextEditingController();
  bool _busy = false;
  String? _inlineError;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  String _memberStatusLabel(String status) => switch (status) {
    'joined' => 'Đã điểm danh',
    'no_show' => 'Không tham gia',
    'left' => 'Đã rời chuyến',
    _ => 'Đã xác nhận',
  };

  Future<void> _sendInvite() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _inlineError = 'Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    setState(() {
      _busy = true;
      _inlineError = null;
    });
    try {
      final res = await ref
          .read(bookingInvitationsApiProvider)
          .inviteBookingMember(widget.bookingId, email);
      _emailController.clear();
      ref.invalidate(bookingMembersWorkspaceProvider(widget.bookingId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            res.emailSent
                ? 'Đã gửi lời mời tới ${res.invitation.invitedEmail}.'
                : 'Đã tạo lời mời cho ${res.invitation.invitedEmail}. Hãy sao chép liên kết để gửi cho bạn đi cùng.',
          ),
        ),
      );
    } catch (error) {
      if (mounted) setState(() => _inlineError = bookingErrorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copyLink(BookingInvitationItem invitation) async {
    await Clipboard.setData(ClipboardData(text: invitation.shareableLink));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Đã sao chép liên kết mời tham gia.')),
    );
  }

  Future<void> _confirmRevoke(BookingInvitationItem invitation) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Thu hồi lời mời'),
        content: Text(
          'Bạn có chắc muốn thu hồi lời mời gửi tới ${invitation.invitedEmail}?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Thu hồi')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(bookingInvitationsApiProvider)
          .revokeBookingInvitation(widget.bookingId, invitation.id);
      ref.invalidate(bookingMembersWorkspaceProvider(widget.bookingId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã thu hồi lời mời.')),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(bookingErrorText(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmRemove(BookingMemberItem member) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Gỡ thành viên'),
        content: Text('Bạn có chắc muốn gỡ ${member.displayName} khỏi đơn đặt chỗ này?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Gỡ')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(bookingInvitationsApiProvider).removeBookingMember(widget.bookingId, member.id);
      ref.invalidate(bookingMembersWorkspaceProvider(widget.bookingId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã gỡ thành viên khỏi đơn đặt chỗ.')),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(bookingErrorText(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(bookingMembersWorkspaceProvider(widget.bookingId));
    return query.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (workspace) => CtmsSectionCard(
        title: 'Người tham gia (${workspace.activeMemberCount}/${workspace.numPeople})',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (workspace.remainingSlots > 0 && workspace.canManage) ...[
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'Còn ${workspace.remainingSlots} chỗ trống. Mỗi thành viên cần có tài khoản DiTrek để điểm danh, tải bản đồ ngoại tuyến và theo dõi GPS an toàn.',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            for (final member in workspace.members) ...[
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(member.displayName, style: AppTypography.bodyStrong),
                          if (member.email != null && member.displayName != member.email)
                            Text(
                              member.email!,
                              style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                            ),
                          const SizedBox(height: 2),
                          Text(
                            member.isPrimary ? 'Người đặt chỗ chính' : 'Thành viên đi cùng',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.brandPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    CtmsStatusBadge(
                      label: _memberStatusLabel(member.memberStatus),
                      status: CtmsStatus.success,
                    ),
                    if (workspace.canManage &&
                        !member.isPrimary &&
                        member.memberStatus == 'registered') ...[
                      const SizedBox(width: AppSpacing.xs),
                      IconButton(
                        tooltip: 'Gỡ thành viên',
                        onPressed: _busy ? null : () => _confirmRemove(member),
                        icon: const Icon(Icons.person_remove_outlined, size: 20),
                        color: AppColors.statusDanger,
                      ),
                    ],
                  ],
                ),
              ),
            ],
            if (workspace.invitations.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Lời mời đang chờ xác nhận',
                style: AppTypography.caption.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final inv in workspace.invitations) ...[
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.statusWarningBg,
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        inv.invitedUserFullName?.trim().isNotEmpty == true
                            ? inv.invitedUserFullName!.trim()
                            : inv.invitedEmail,
                        style: AppTypography.bodyStrong,
                      ),
                      if (inv.invitedUserFullName?.trim().isNotEmpty == true)
                        Text(
                          inv.invitedEmail,
                          style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                        ),
                      const SizedBox(height: 4),
                      Text(
                        inv.hasAccount
                            ? 'Đã có tài khoản DiTrek · Chờ chấp nhận'
                            : 'Chưa có tài khoản · Cần đăng ký DiTrek qua link mời',
                        style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                      ),
                      if (workspace.canManage) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () => _copyLink(inv),
                                icon: const Icon(Icons.copy, size: 16),
                                label: const Text('Sao chép link'),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            TextButton(
                              onPressed: _busy ? null : () => _confirmRevoke(inv),
                              child: Text(
                                'Thu hồi',
                                style: TextStyle(color: AppColors.statusDanger),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ],
            if (workspace.canManage && workspace.remainingSlots > 0) ...[
              const SizedBox(height: AppSpacing.sm),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                enabled: !_busy,
                decoration: InputDecoration(
                  labelText: 'Email thành viên đi cùng',
                  hintText: 'nhap.email@example.com',
                  errorText: _inlineError,
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              CtmsButton(
                label: 'Gửi lời mời tham gia',
                isLoading: _busy,
                onPressed: _sendInvite,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
