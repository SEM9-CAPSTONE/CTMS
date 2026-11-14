import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../application/offline_trip_providers.dart';
import '../application/package_download_controller.dart';
import 'offline_trip_screen.dart';

class SavedOfflinePackagesButton extends ConsumerWidget {
  const SavedOfflinePackagesButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accountId = ref.watch(offlinePackageAccountProvider);
    return IconButton(
      tooltip: 'Dữ liệu ngoại tuyến đã lưu',
      icon: const Icon(Icons.offline_pin_outlined),
      onPressed: accountId == null
          ? null
          : () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) =>
                    _SavedOfflinePackagesScreen(accountId: accountId),
              ),
            ),
    );
  }
}

class _SavedOfflinePackagesScreen extends ConsumerWidget {
  const _SavedOfflinePackagesScreen({required this.accountId});

  final String accountId;
  static final _date = DateFormat('dd/MM/yyyy HH:mm');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentAccount = ref.watch(offlinePackageAccountProvider);
    final packages = currentAccount == accountId
        ? ref.watch(savedOfflinePackagesProvider(accountId))
        : null;
    const empty = CtmsEmptyState(
      icon: Icons.offline_pin_outlined,
      title: 'Chưa có chuyến đi được lưu',
    );
    return CtmsScaffold(
      title: 'Dữ liệu ngoại tuyến đã lưu',
      body:
          packages?.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (_, _) =>
                const CtmsEmptyState(title: 'Không đọc được dữ liệu đã lưu'),
            data: (items) => items.isEmpty
                ? empty
                : ListView.builder(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final (package: package, tripTitle: title) = items[index];
                      final tripTitle = title ?? 'Chuyến đi đã lưu';
                      return Card(
                        child: ListTile(
                          title: Text(tripTitle),
                          subtitle: Text(
                            'Bản ${package.packageVersion} · ${_date.format(package.generatedAt.toLocal())}',
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => OfflineTripScreen(
                                tripTitle: tripTitle,
                                selection: (
                                  accountId: accountId,
                                  tripId: package.tripId,
                                  version: package.packageVersion,
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ) ??
          empty,
    );
  }
}
