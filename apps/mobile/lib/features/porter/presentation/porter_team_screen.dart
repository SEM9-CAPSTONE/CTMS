import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../../member_locations/application/member_locations_controller.dart';
import '../../trip_operations/application/trip_operations_providers.dart';
import '../../trip_operations/domain/operational_trip.dart';

class _RosterMember {
  const _RosterMember({
    required this.memberId,
    required this.bookingId,
    required this.displayName,
    required this.email,
    required this.memberStatus,
    this.bookingStatus,
  });

  final String memberId;
  final String bookingId;
  final String displayName;
  final String email;
  final String memberStatus;
  final String? bookingStatus;

  factory _RosterMember.fromJson(Map<String, Object?> json) {
    final name = (json['displayName'] as String?)?.trim();
    final email = (json['email'] as String?)?.trim() ?? '';
    return _RosterMember(
      memberId: json['memberId'] as String? ?? '',
      bookingId: json['bookingId'] as String? ?? '',
      displayName: (name != null && name.isNotEmpty)
          ? name
          : (email.isNotEmpty ? email : 'Thành viên'),
      email: email,
      memberStatus: json['memberStatus'] as String? ?? 'registered',
      bookingStatus: json['bookingStatus'] as String?,
    );
  }
}

class PorterTeamScreen extends ConsumerStatefulWidget {
  const PorterTeamScreen({super.key});

  @override
  ConsumerState<PorterTeamScreen> createState() => _PorterTeamScreenState();
}

class _PorterTeamScreenState extends ConsumerState<PorterTeamScreen> {
  String? _loadedTripId;
  bool _loading = false;
  String? _error;
  List<_RosterMember> _members = const [];
  final Set<String> _updatingMemberIds = <String>{};

  Future<void> _loadRoster(String tripId) async {
    setState(() {
      _loadedTripId = tripId;
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.get<Map<String, Object?>>(
        '/trips/$tripId/members',
      );
      final rawMembers =
          (response.data?['members'] as List<Object?>?) ?? const [];
      final parsed = rawMembers
          .whereType<Map<String, Object?>>()
          .map(_RosterMember.fromJson)
          .where((m) => m.memberStatus != 'removed')
          .toList();
      if (!mounted) return;
      setState(() {
        _members = parsed;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message.isNotEmpty
            ? e.message
            : 'Không thể tải danh sách thành viên.';
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Không thể tải danh sách thành viên. Vui lòng thử lại.';
        _loading = false;
      });
    }
  }

  Future<void> _updateMemberStatus(
    String tripId,
    _RosterMember member,
    String targetStatus,
  ) async {
    if (_updatingMemberIds.contains(member.memberId)) return;
    setState(() => _updatingMemberIds.add(member.memberId));
    try {
      final client = ref.read(apiClientProvider);
      await client.patch<Map<String, Object?>>(
        '/trips/$tripId/bookings/${member.bookingId}/members/${member.memberId}/status',
        data: <String, Object?>{'status': targetStatus},
      );
      if (!mounted) return;
      await _loadRoster(tripId);
      ref.invalidate(memberLocationsControllerProvider(tripId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            targetStatus == 'joined'
                ? 'Đã điểm danh có mặt cho ${member.displayName}.'
                : 'Đã đánh dấu vắng mặt cho ${member.displayName}.',
          ),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.message.isNotEmpty
                ? e.message
                : 'Không thể cập nhật điểm danh. Vui lòng thử lại.',
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không thể cập nhật điểm danh. Vui lòng thử lại.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _updatingMemberIds.remove(member.memberId));
      }
    }
  }

  OperationalTrip _resolveActiveTrip(
    List<OperationalTrip> trips,
    String? selectedId,
  ) {
    if (selectedId != null) {
      for (final trip in trips) {
        if (trip.id == selectedId) return trip;
      }
    }
    return trips.firstWhere(
      (trip) => trip.status == OperationalTripStatus.ongoing,
      orElse: () => trips.firstWhere(
        (trip) => trip.status == OperationalTripStatus.published,
        orElse: () => trips.first,
      ),
    );
  }

  (String, CtmsStatus) _statusBadge(String status) => switch (status) {
    'joined' => ('Đã có mặt', CtmsStatus.success),
    'no_show' => ('Vắng mặt', CtmsStatus.danger),
    'left' => ('Đã rời đoàn', CtmsStatus.neutral),
    _ => ('Chưa điểm danh', CtmsStatus.warning),
  };

  @override
  Widget build(BuildContext context) {
    final account = ref.watch(porterOperationsAccountProvider);
    final selectedId = ref.watch(selectedPorterTripIdProvider);

    if (account == null) {
      return const CtmsScaffold(
        title: 'Thành viên đoàn',
        body: CtmsEmptyState(
          icon: Icons.person_off_outlined,
          title: 'Vui lòng đăng nhập lại',
          message: 'Không xác định được tài khoản người hỗ trợ.',
        ),
      );
    }

    final tripsAsync = ref.watch(assignedOperationalTripsProvider(account));

    return tripsAsync.when(
      loading: () => const CtmsScaffold(
        title: 'Thành viên đoàn',
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (_, _) => CtmsScaffold(
        title: 'Thành viên đoàn',
        body: CtmsEmptyState(
          icon: Icons.wifi_off_outlined,
          title: 'Không tải được chuyến đi',
          message: 'Kiểm tra kết nối mạng và thử lại.',
          action: CtmsButton(
            label: 'Thử lại',
            onPressed: () =>
                ref.invalidate(assignedOperationalTripsProvider(account)),
          ),
        ),
      ),
      data: (trips) {
        if (trips.isEmpty) {
          return const CtmsScaffold(
            title: 'Thành viên đoàn',
            body: CtmsEmptyState(
              icon: Icons.groups_outlined,
              title: 'Chưa có chuyến đi được phân công',
              message: 'Khi có chuyến đi được giao, danh sách điểm danh sẽ hiện tại đây.',
            ),
          );
        }

        final activeTrip = _resolveActiveTrip(trips, selectedId);
        if (_loadedTripId != activeTrip.id && !_loading) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted && _loadedTripId != activeTrip.id) {
              _loadRoster(activeTrip.id);
            }
          });
        }

        final joinedCount = _members
            .where((m) => m.memberStatus == 'joined')
            .length;
        final pendingCount = _members
            .where((m) => m.memberStatus == 'registered')
            .length;
        final noShowCount = _members
            .where((m) => m.memberStatus == 'no_show')
            .length;

        return CtmsScaffold(
          title: 'Thành viên đoàn',
          subtitle: activeTrip.title,
          actions: [
            IconButton(
              tooltip: 'Làm mới danh sách',
              icon: const Icon(Icons.refresh),
              onPressed: _loading ? null : () => _loadRoster(activeTrip.id),
            ),
          ],
          body: RefreshIndicator(
            onRefresh: () => _loadRoster(activeTrip.id),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.xxl),
              children: [
                if (trips.length > 1) ...[
                  DropdownButtonFormField<String>(
                    initialValue: activeTrip.id,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Chuyến đi đang chọn',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                    ),
                    items: trips
                        .map(
                          (trip) => DropdownMenuItem(
                            value: trip.id,
                            child: Text(
                              trip.title,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value == null || value == activeTrip.id) return;
                      ref.read(selectedPorterTripIdProvider.notifier).state =
                          value;
                      _loadRoster(value);
                    },
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
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
                            '$joinedCount/${_members.length}',
                            style: AppTypography.display.copyWith(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Đã điểm danh',
                            style: AppTypography.caption.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      Container(width: 1, height: 40, color: AppColors.border),
                      Column(
                        children: [
                          Text(
                            '$pendingCount',
                            style: AppTypography.display.copyWith(
                              color: pendingCount > 0
                                  ? AppColors.statusWarning
                                  : AppColors.statusSuccess,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Chưa điểm danh',
                            style: AppTypography.caption.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      Container(width: 1, height: 40, color: AppColors.border),
                      Column(
                        children: [
                          Text(
                            '$noShowCount',
                            style: AppTypography.display.copyWith(
                              color: noShowCount > 0
                                  ? AppColors.statusDanger
                                  : AppColors.textSecondary,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Vắng mặt',
                            style: AppTypography.caption.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: AppSpacing.xxl),

                if (_loading && _members.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (_error != null)
                  CtmsEmptyState(
                    icon: Icons.error_outline,
                    title: 'Không tải được danh sách',
                    message: _error!,
                    action: CtmsButton(
                      label: 'Thử lại',
                      onPressed: () => _loadRoster(activeTrip.id),
                    ),
                  )
                else if (_members.isEmpty)
                  const CtmsEmptyState(
                    icon: Icons.groups_outlined,
                    title: 'Chưa có thành viên đăng ký',
                    message: 'Chuyến đi này hiện chưa có thành viên nào.',
                  )
                else ...[
                  Text(
                    'Danh sách thành viên (${_members.length})',
                    style: AppTypography.h3.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  ..._members.map((member) {
                    final (badgeLabel, badgeStatus) = _statusBadge(
                      member.memberStatus,
                    );
                    final isBusy = _updatingMemberIds.contains(member.memberId);
                    final isJoined = member.memberStatus == 'joined';
                    final isNoShow = member.memberStatus == 'no_show';
                    final initial = member.displayName
                        .trim()
                        .split(RegExp(r'\s+'))
                        .last
                        .substring(0, 1)
                        .toUpperCase();

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
                                  initial,
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
                                      member.displayName,
                                      style: AppTypography.bodyStrong.copyWith(
                                        color: AppColors.textPrimary,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    if (member.email.isNotEmpty) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        member.email,
                                        style: AppTypography.caption.copyWith(
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              CtmsStatusBadge(
                                label: badgeLabel,
                                status: badgeStatus,
                                showDot: true,
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          const Divider(
                            height: 1,
                            thickness: 1,
                            color: AppColors.border,
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              if (!isNoShow)
                                CtmsButton(
                                  label: 'Vắng mặt',
                                  variant: CtmsButtonVariant.secondary,
                                  onPressed: isBusy
                                      ? null
                                      : () => _updateMemberStatus(
                                          activeTrip.id,
                                          member,
                                          'no_show',
                                        ),
                                ),
                              if (!isNoShow && !isJoined)
                                const SizedBox(width: AppSpacing.sm),
                              if (!isJoined)
                                CtmsButton(
                                  label: isBusy
                                      ? 'Đang lưu...'
                                      : 'Điểm danh có mặt',
                                  variant: CtmsButtonVariant.primary,
                                  onPressed: isBusy
                                      ? null
                                      : () => _updateMemberStatus(
                                          activeTrip.id,
                                          member,
                                          'joined',
                                        ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
