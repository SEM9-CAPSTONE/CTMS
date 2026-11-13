// Visual review fixtures only. This entry point is never imported by the app.
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/user_role.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';
import 'package:mobile/features/offline_packages/domain/package_policy.dart';
import 'package:mobile/features/offline_packages/presentation/departure_status_panel.dart';
import 'package:mobile/features/offline_packages/presentation/offline_package_screen.dart';

const galleryTrip = '11111111-1111-4111-8111-111111111111';
const galleryPackage = '22222222-2222-4222-8222-222222222222';
const galleryModes = [
  'Chưa xác định',
  'Bản mới tùy chọn',
  'Bắt buộc cập nhật',
  'Porter đã có bản bắt buộc',
  'Đang tải',
  'Gói hỏng',
  'Chờ đồng bộ',
  'Đang diễn ra',
  'Ngoại tuyến',
  'Mất quyền (403)',
  'Không có yêu cầu',
  'Chưa có gói',
];

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SemanticsBinding.instance.ensureSemantics();
  runApp(const PackagePolicyGallery());
}

class _PreviewAuth extends AuthController {
  _PreviewAuth(this.porter);
  final bool porter;
  @override
  Future<AuthUser?> build() async => AuthUser(
    id: 'preview',
    email: 'preview@example.test',
    role: porter ? UserRole.porter : UserRole.camper,
  );
}

class _PreviewDownload extends PackageDownloadController {
  _PreviewDownload()
    : super(galleryTrip, () => throw StateError('Fixture only'));
  @override
  Future<void> load() async {}
  @override
  Future<void> start({String? tripTitle}) async {}
  @override
  Future<void> confirmDeparture() async {}
}

class PackagePolicyGallery extends StatefulWidget {
  const PackagePolicyGallery({super.key});
  @override
  State<PackagePolicyGallery> createState() => _PackagePolicyGalleryState();
}

class _PackagePolicyGalleryState extends State<PackagePolicyGallery> {
  late String mode;
  late bool porter;
  @override
  void initState() {
    super.initState();
    mode = Uri.base.queryParameters['state'] ?? galleryModes.first;
    if (!galleryModes.contains(mode)) mode = galleryModes.first;
    porter = Uri.base.queryParameters['role'] != 'camper';
  }

  _PreviewDownload fixture() {
    final package = OfflinePackage(
      id: galleryPackage,
      tripId: galleryTrip,
      packageVersion: 1,
      sha256: List.filled(64, 'a').join(),
      sizeBytes: 204800,
      generatedAt: DateTime.utc(2026, 11, 12),
    );
    final required = [
      'Bắt buộc cập nhật',
      'Porter đã có bản bắt buộc',
    ].contains(mode);
    final locked = mode == 'Đang diễn ra';
    final hasLocal = !['Chưa có gói', 'Mất quyền (403)'].contains(mode);
    final controller = _PreviewDownload()
      ..loading = false
      ..package = mode == 'Chưa có gói' ? null : package
      ..active = hasLocal ? package : null
      ..basemapReady = hasLocal
      ..basemapPackageId = hasLocal ? galleryPackage : null
      ..downloading = mode == 'Đang tải'
      ..local = mode == 'Đang tải'
          ? LocalPackageDownload(
              package,
              PackageDownloadStatus.downloading,
              102400,
            )
          : null
      ..verification = mode == 'Gói hỏng'
          ? PackageVerificationStatus.failed
          : mode == 'Đang tải'
          ? PackageVerificationStatus.pending
          : PackageVerificationStatus.verified
      ..awaitingActivation = mode == 'Chờ đồng bộ'
      ..policyOffline = mode == 'Ngoại tuyến'
      ..policyError = mode == 'Mất quyền (403)'
          ? 'Bạn không có quyền truy cập gói này.'
          : mode == 'Ngoại tuyến'
          ? 'Chưa xác thực lại với máy chủ. Chỉ hiển thị trạng thái đã biết.'
          : null;
    if (mode == 'Mất quyền (403)') {
      controller.package = null;
      controller.verification = PackageVerificationStatus.pending;
      controller.error = downloadErrorMessage(
        ApiException('', statusCode: 403),
      );
    }
    if ([
      'Bản mới tùy chọn',
      'Bắt buộc cập nhật',
      'Đang tải',
      'Chờ đồng bộ',
      'Gói hỏng',
    ].contains(mode)) {
      final next = OfflinePackage(
        id: '33333333-3333-4333-8333-333333333333',
        tripId: galleryTrip,
        packageVersion: 2,
        sha256: List.filled(64, 'b').join(),
        sizeBytes: 204800,
        generatedAt: DateTime.utc(2026, 11, 12, 2),
      );
      controller.package = next;
      if (mode == 'Đang tải') {
        controller.local = LocalPackageDownload(
          next,
          PackageDownloadStatus.downloading,
          102400,
        );
      } else if (mode == 'Chờ đồng bộ') {
        controller.local = LocalPackageDownload(
          next,
          PackageDownloadStatus.downloaded,
          next.sizeBytes,
        );
      } else if (mode != 'Gói hỏng') {
        controller.verification = PackageVerificationStatus.pending;
      }
    }
    controller.policy = ['Mất quyền (403)', 'Chưa có gói'].contains(mode)
        ? null
        : PackagePolicy({
            'tripStatus': locked ? 'ongoing' : 'published',
            'replaceAllowed': !locked,
            'checkedAt': '2026-11-12T03:00:00Z',
            'selected': {
              'packageId': galleryPackage,
              'updatedAt': '2026-11-12T00:00:00Z',
            },
            'publication': {
              'newerAvailable':
                  mode == 'Bắt buộc cập nhật' ||
                  locked ||
                  mode == 'Bản mới tùy chọn' ||
                  ['Đang tải', 'Gói hỏng', 'Chờ đồng bộ'].contains(mode),
              'updateRequired': mode == 'Bắt buộc cập nhật',
              'requiredPackageId': required
                  ? mode == 'Bắt buộc cập nhật'
                        ? '33333333-3333-4333-8333-333333333333'
                        : galleryPackage
                  : null,
              'requiredVersion': required
                  ? mode == 'Bắt buộc cập nhật'
                        ? 2
                        : 1
                  : null,
            },
            'sourceFreshness': {'state': 'unknown'},
          });
    return controller;
  }

  @override
  Widget build(BuildContext context) => ProviderScope(
    key: ValueKey('$mode-$porter'),
    overrides: [
      authControllerProvider.overrideWith(() => _PreviewAuth(porter)),
      offlinePackageAccountProvider.overrideWithValue('preview'),
      packageDownloadControllerProvider(
        galleryTrip,
      ).overrideWith((ref) => fixture()),
      departureStatusProvider(galleryTrip).overrideWith((ref) async {
        if (mode == 'Mất quyền (403)') {
          throw ApiException('Forbidden', statusCode: 403);
        }
        return {'blocked': false};
      }),
    ],
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: Scaffold(
        appBar: AppBar(title: const Text('Duyệt giao diện CTMS-306')),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 500),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'DỮ LIỆU MẪU — chưa phải bằng chứng kiểm thử kết nối thật.',
                ),
                const SizedBox(height: 12),
                if (Uri.base.queryParameters['capture'] == '1')
                  Text(
                    '${mode == 'Porter đã có bản bắt buộc'
                        ? 'Đã có gói bắt buộc'
                        : mode == 'Mất quyền (403)'
                        ? 'Mất quyền truy cập'
                        : mode} · ${porter ? 'Người hỗ trợ' : 'Khách tham gia'}',
                  ),
                if (Uri.base.queryParameters['capture'] != '1')
                  DropdownButtonFormField<String>(
                    initialValue: mode,
                    isExpanded: true,
                    items: galleryModes
                        .map(
                          (name) => DropdownMenuItem(
                            value: name,
                            child: Text(
                              name == 'Porter đã có bản bắt buộc'
                                  ? 'Đã có gói bắt buộc'
                                  : name == 'Mất quyền (403)'
                                  ? 'Mất quyền truy cập'
                                  : name,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) => setState(() => mode = value!),
                  ),
                if (Uri.base.queryParameters['capture'] != '1')
                  SwitchListTile(
                    title: const Text(
                      'Người hỗ trợ (tắt để xem khách tham gia)',
                    ),
                    value: porter,
                    onChanged: (value) => setState(() => porter = value),
                  ),
                const OfflinePackagePanel(tripId: galleryTrip),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
