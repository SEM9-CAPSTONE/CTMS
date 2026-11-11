import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_status_badge.dart';

class _TeamMember {
  const _TeamMember({
    required this.name,
    required this.phone,
    required this.checkedIn,
    this.specialNote,
  });

  final String name;
  final String phone;
  final bool checkedIn;
  final String? specialNote;
}

const _kMembers = [
  _TeamMember(name: 'Trần Văn Minh', phone: '0912 345 678', checkedIn: true),
  _TeamMember(
    name: 'Nguyễn Hoàng Nam',
    phone: '0988 123 456',
    checkedIn: true,
    specialNote: 'Tiền sử hen suyễn nhẹ (Có thuốc cá nhân)',
  ),
  _TeamMember(name: 'Lê Thị Thu Thảo', phone: '0903 234 567', checkedIn: true),
  _TeamMember(
    name: 'Phạm Đức Anh',
    phone: '0977 889 900',
    checkedIn: false,
    specialNote: 'Đang di chuyển đến điểm tập kết trạm Cổng Bắc',
  ),
  _TeamMember(name: 'Vũ Minh Tuấn', phone: '0934 567 890', checkedIn: true),
  _TeamMember(name: 'Hoàng Mai Phương', phone: '0918 223 344', checkedIn: false),
];

class PorterTeamScreen extends StatefulWidget {
  const PorterTeamScreen({super.key});

  @override
  State<PorterTeamScreen> createState() => _PorterTeamScreenState();
}

class _PorterTeamScreenState extends State<PorterTeamScreen> {
  late List<_TeamMember> _members;

  @override
  void initState() {
    super.initState();
    _members = List.of(_kMembers);
  }

  void _toggleCheckIn(int index) {
    setState(() {
      final current = _members[index];
      _members[index] = _TeamMember(
        name: current.name,
        phone: current.phone,
        checkedIn: !current.checkedIn,
        specialNote: current.specialNote,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final checkedInCount = _members.where((m) => m.checkedIn).length;

    return CtmsScaffold(
      title: 'Thành viên đoàn',
      subtitle: 'Danh sách và điểm danh camper trong ca trekking',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        children: [
          // 1. Overview Stat Card
          Container(
            padding: const EdgeInsets.all(AppSpacing.cardPadding),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: AppRadius.cardBorderRadius,
              border: Border.all(color: AppColors.border, width: 1.0),
              boxShadow: AppColors.cardShadowSm,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                Column(
                  children: [
                    Text(
                      '$checkedInCount/${_members.length}',
                      style: AppTypography.display.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text('Đã điểm danh', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700)),
                  ],
                ),
                Container(width: 1, height: 40, color: AppColors.border),
                Column(
                  children: [
                    Text(
                      '${_members.length - checkedInCount}',
                      style: AppTypography.display.copyWith(
                        color: (_members.length - checkedInCount) > 0
                            ? AppColors.statusWarning
                            : AppColors.statusSuccess,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text('Chưa có mặt', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700)),
                  ],
                ),
                Container(width: 1, height: 40, color: AppColors.border),
                Column(
                  children: [
                    Text(
                      '2',
                      style: AppTypography.display.copyWith(
                        color: AppColors.statusDanger,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text('Lưu ý y tế', style: AppTypography.caption.copyWith(fontWeight: FontWeight.w700)),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.xxl),

          // 2. Members List
          Text(
            'Danh sách camper (${_members.length})',
            style: AppTypography.h3.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          ...List.generate(_members.length, (index) {
            final member = _members[index];
            return Container(
              margin: const EdgeInsets.only(bottom: AppSpacing.md),
              padding: const EdgeInsets.all(AppSpacing.cardPadding),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.cardBorderRadius,
                border: Border.all(color: AppColors.border, width: 1.0),
                boxShadow: AppColors.cardShadowSm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CircleAvatar(
                        backgroundColor: AppColors.brandBg,
                        radius: 20,
                        child: Text(
                          member.name.split(' ').last.substring(0, 1),
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              member.name,
                              style: AppTypography.bodyStrong.copyWith(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              member.phone,
                              style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      CtmsStatusBadge(
                        label: member.checkedIn ? 'Đã có mặt' : 'Chưa đến',
                        status: member.checkedIn ? CtmsStatus.success : CtmsStatus.warning,
                        showDot: true,
                      ),
                    ],
                  ),
                  if (member.specialNote != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.brandBg,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline, size: 14, color: AppColors.textPrimary),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              member.specialNote!,
                              style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.sm),
                  const Divider(height: 1, thickness: 1, color: AppColors.border),
                  const SizedBox(height: AppSpacing.sm),
                  Align(
                    alignment: Alignment.centerRight,
                    child: CtmsButton(
                      label: member.checkedIn ? 'Hủy điểm danh' : 'Điểm danh ngay',
                      variant: member.checkedIn
                          ? CtmsButtonVariant.secondary
                          : CtmsButtonVariant.primary,
                      onPressed: () => _toggleCheckIn(index),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
