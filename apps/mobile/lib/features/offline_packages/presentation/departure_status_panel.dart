import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../auth/application/auth_controller.dart';
import 'package_policy_copy.dart';

final departureStatusProvider = FutureProvider.autoDispose
    .family<Map<String, Object?>, String>((ref, trip) async {
      final user = ref.watch(authControllerProvider).asData?.value;
      if (user == null) return {'blocked': false};
      final response = await ref
          .watch(apiClientProvider)
          .get<Map<String, Object?>>(
            '/trips/$trip/offline-package-policy/departure-status',
          );
      return response.data!;
    });

/// Read-only group status. Confirmation belongs exclusively to the Porter device flow.
class DepartureStatusPanel extends ConsumerStatefulWidget {
  const DepartureStatusPanel({super.key, required this.tripId});
  final String tripId;
  @override
  ConsumerState<DepartureStatusPanel> createState() =>
      _DepartureStatusPanelState();
}

class _DepartureStatusPanelState extends ConsumerState<DepartureStatusPanel>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void refresh() {
    ref.invalidate(departureStatusProvider(widget.tripId));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) refresh();
  }

  @override
  Widget build(BuildContext context) {
    final status = ref.watch(departureStatusProvider(widget.tripId));
    final denied =
        status.error is ApiException &&
        [401, 403, 404].contains((status.error as ApiException).statusCode);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        status.when(
          loading: () => const Text('Đang kiểm tra khởi hành…'),
          // The enclosing package panel owns the single access-denied message.
          error: (error, _) => denied
              ? const SizedBox.shrink()
              : const Text('Chưa kiểm tra được khởi hành.'),
          data: (data) => data['blocked'] == true
              ? Text(packageReasonLabel(data['reasonCode'] as String?))
              : const SizedBox.shrink(),
        ),
        if (!denied && status.hasError)
          TextButton(
            onPressed: refresh,
            child: const Text('Kiểm tra khởi hành'),
          ),
      ],
    );
  }
}
