import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_loading_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/presentation/widgets/logout_actions.dart';
import '../../sync/presentation/device_sync_status_screen.dart';
import '../profile/application/camper_health_profile_controller.dart';
import '../profile/application/camper_profile_controller.dart';
import '../profile/domain/camper_profile.dart';
import '../profile/domain/health_profile.dart';

class CamperProfileScreen extends ConsumerStatefulWidget {
  const CamperProfileScreen({super.key});

  @override
  ConsumerState<CamperProfileScreen> createState() =>
      _CamperProfileScreenState();
}

class _CamperProfileScreenState extends ConsumerState<CamperProfileScreen> {
  final _personalFormKey = GlobalKey<FormState>();
  final _healthFormKey = GlobalKey<FormState>();

  int _activeTab = 0; // 0: Personal & Emergency, 1: Health & Fitness

  // Personal Profile fields
  final _accountEmail = TextEditingController();
  final _accountPhone = TextEditingController();
  final _fullName = TextEditingController();
  final _dateOfBirth = TextEditingController();
  final _address = TextEditingController();
  final _bio = TextEditingController();
  final _contact1Name = TextEditingController();
  final _contact1Relationship = TextEditingController();
  final _contact1Phone = TextEditingController();
  final _contact1Email = TextEditingController();
  final _contact2Name = TextEditingController();
  final _contact2Relationship = TextEditingController();
  final _contact2Phone = TextEditingController();
  final _contact2Email = TextEditingController();
  String _gender = 'male';
  int _contactCount = 0;
  String? _loadedProfileId;
  bool _isSavingPersonal = false;

  // Health Profile fields
  final _dietaryRestrictions = TextEditingController();
  final _emergencyNotes = TextEditingController();
  String _bloodType = 'UNKNOWN';
  String _physicalFitnessLevel = 'BEGINNER';
  final List<AllergyItem> _allergies = [];
  final List<MedicalConditionItem> _medicalConditions = [];
  bool _isConsentGranted = false;
  String? _loadedHealthProfileId;
  int _healthProfileVersion = 1;
  bool _isSavingHealth = false;

  @override
  void dispose() {
    _accountEmail.dispose();
    _accountPhone.dispose();
    _fullName.dispose();
    _dateOfBirth.dispose();
    _address.dispose();
    _bio.dispose();
    _contact1Name.dispose();
    _contact1Relationship.dispose();
    _contact1Phone.dispose();
    _contact1Email.dispose();
    _contact2Name.dispose();
    _contact2Relationship.dispose();
    _contact2Phone.dispose();
    _contact2Email.dispose();

    _dietaryRestrictions.dispose();
    _emergencyNotes.dispose();
    super.dispose();
  }

  void _hydratePersonal(CamperProfile profile) {
    if (_loadedProfileId == profile.id) return;
    _loadedProfileId = profile.id;
    _accountEmail.text = profile.email ?? '';
    _accountPhone.text = profile.phone ?? '';
    _fullName.text = profile.fullName;
    _dateOfBirth.text = profile.dateOfBirth;
    _gender = profile.gender;
    _address.text = profile.address;
    _bio.text = profile.bio;
    _contactCount = profile.emergencyContacts.length > 2
        ? 2
        : profile.emergencyContacts.length;
    if (_contactCount > 0) _fillContact(profile.emergencyContacts[0], 1);
    if (_contactCount > 1) _fillContact(profile.emergencyContacts[1], 2);
  }

  void _fillContact(EmergencyContact contact, int index) {
    final name = index == 1 ? _contact1Name : _contact2Name;
    final relationship = index == 1
        ? _contact1Relationship
        : _contact2Relationship;
    final phone = index == 1 ? _contact1Phone : _contact2Phone;
    final email = index == 1 ? _contact1Email : _contact2Email;
    name.text = contact.name;
    relationship.text = contact.relationship;
    phone.text = contact.phone;
    email.text = contact.email ?? '';
  }

  void _hydrateHealth(HealthProfile profile) {
    if (_loadedHealthProfileId == profile.id) return;
    _loadedHealthProfileId = profile.id;
    _healthProfileVersion = profile.version;
    _dietaryRestrictions.text = profile.dietaryRestrictions;
    _emergencyNotes.text = profile.emergencyNotes;
    _bloodType = profile.bloodType;
    _physicalFitnessLevel = profile.physicalFitnessLevel;
    _isConsentGranted = profile.consent.isConsentGranted;

    _allergies.clear();
    _allergies.addAll(profile.allergies);

    _medicalConditions.clear();
    _medicalConditions.addAll(profile.medicalConditions);
  }

  String? _required(String? value) {
    if (value == null || value.trim().isEmpty) return 'Bắt buộc';
    return null;
  }

  String? _minLength(String? value, int min) {
    final required = _required(value);
    if (required != null) return required;
    if (value!.trim().length < min) return 'Tối thiểu $min ký tự';
    return null;
  }

  String? _phone(String? value) {
    final required = _required(value);
    if (required != null) return required;
    final regex = RegExp(r'^(0|\+84)(3|5|7|8|9)\d{8}$');
    if (!regex.hasMatch(value!.trim())) return 'Số điện thoại không hợp lệ';
    return null;
  }

  String? _email(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    final regex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    if (!regex.hasMatch(value.trim())) return 'Email không hợp lệ';
    return null;
  }

  String? _date(String? value) {
    final required = _required(value);
    if (required != null) return required;

    final trimmed = value!.trim();
    final match = RegExp(r'^(\d{2})/(\d{2})/(\d{4})$').firstMatch(trimmed);
    if (match == null) return 'Ngày sinh phải theo định dạng dd/mm/yyyy';

    final day = int.tryParse(match.group(1)!);
    final month = int.tryParse(match.group(2)!);
    final year = int.tryParse(match.group(3)!);
    if (day == null || month == null || year == null) {
      return 'Ngày sinh không hợp lệ';
    }

    final parsed = DateTime(year, month, day);
    if (parsed.day != day || parsed.month != month || parsed.year != year) {
      return 'Ngày sinh không hợp lệ';
    }
    if (parsed.isAfter(DateTime.now())) {
      return 'Ngày sinh không được ở tương lai';
    }
    return null;
  }

  List<EmergencyContact> _contactsFromForm() {
    final contacts = <EmergencyContact>[];
    if (_contactCount >= 1) {
      contacts.add(
        EmergencyContact(
          name: _contact1Name.text.trim(),
          relationship: _contact1Relationship.text.trim(),
          phone: _contact1Phone.text.trim(),
          email: _contact1Email.text.trim().isEmpty
              ? null
              : _contact1Email.text.trim(),
        ),
      );
    }
    if (_contactCount >= 2) {
      contacts.add(
        EmergencyContact(
          name: _contact2Name.text.trim(),
          relationship: _contact2Relationship.text.trim(),
          phone: _contact2Phone.text.trim(),
          email: _contact2Email.text.trim().isEmpty
              ? null
              : _contact2Email.text.trim(),
        ),
      );
    }
    return contacts;
  }

  Future<void> _savePersonal() async {
    if (_isSavingPersonal ||
        !(_personalFormKey.currentState?.validate() ?? false)) {
      return;
    }
    setState(() => _isSavingPersonal = true);
    final success = await ref
        .read(camperProfileControllerProvider.notifier)
        .save(
          UpdateCamperProfileInput(
            fullName: _fullName.text.trim(),
            dateOfBirth: _dateOfBirth.text.trim(),
            gender: _gender,
            address: _address.text.trim(),
            bio: _bio.text.trim(),
            emergencyContacts: _contactsFromForm(),
          ),
        );
    if (!mounted) return;
    setState(() => _isSavingPersonal = false);
    if (success) {
      _loadedProfileId = null;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Hồ sơ đã được lưu thành công')),
      );
    }
  }

  Future<void> _saveHealth() async {
    if (_isSavingHealth ||
        !(_healthFormKey.currentState?.validate() ?? false)) {
      return;
    }
    setState(() => _isSavingHealth = true);
    final success = await ref
        .read(camperHealthProfileControllerProvider.notifier)
        .save(
          UpdateHealthProfileInput(
            bloodType: _bloodType,
            physicalFitnessLevel: _physicalFitnessLevel,
            dietaryRestrictions: _dietaryRestrictions.text.trim(),
            emergencyNotes: _emergencyNotes.text.trim(),
            allergies: _allergies,
            medicalConditions: _medicalConditions,
            isConsentGranted: _isConsentGranted,
          ),
          _healthProfileVersion,
        );
    if (!mounted) return;
    setState(() => _isSavingHealth = false);
    if (success) {
      _loadedHealthProfileId = null;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Thông tin sức khỏe đã được lưu')),
      );
    }
  }

  Future<void> _toggleConsent(bool grant) async {
    setState(() => _isSavingHealth = true);
    final success = await ref
        .read(camperHealthProfileControllerProvider.notifier)
        .toggleConsent(grant);
    if (!mounted) return;
    setState(() {
      _isSavingHealth = false;
      if (success) {
        _isConsentGranted = grant;
      }
    });
  }

  Widget _buildSeverityBadge(String severity) {
    final (label, status) = switch (severity.toUpperCase()) {
      'CRITICAL' => ('Nguy kịch', CtmsStatus.danger),
      'HIGH' => ('Nghiêm trọng', CtmsStatus.danger),
      'MEDIUM' => ('Trung bình', CtmsStatus.warning),
      _ => ('Nhẹ', CtmsStatus.info),
    };

    return CtmsStatusBadge(
      label: label,
      status: status,
      showDot: true,
    );
  }

  void _showAddAllergyDialog() {
    final nameCtrl = TextEditingController();
    final reactionCtrl = TextEditingController();
    String severity = 'LOW';

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: AppRadius.cardBorderRadius,
                side: const BorderSide(color: AppColors.border),
              ),
              title: Text(
                'Thêm dị ứng',
                style: AppTypography.h3.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: nameCtrl,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Tên dị ứng / Chất gây dị ứng',
                        prefixIcon: Icon(
                          Icons.warning_amber_rounded,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    DropdownButtonFormField<String>(
                      initialValue: severity,
                      decoration: const InputDecoration(
                        labelText: 'Mức độ nghiêm trọng',
                        prefixIcon: Icon(
                          Icons.priority_high,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'LOW',
                          child: Text('Nhẹ (LOW)'),
                        ),
                        DropdownMenuItem(
                          value: 'MEDIUM',
                          child: Text('Trung bình (MEDIUM)'),
                        ),
                        DropdownMenuItem(
                          value: 'HIGH',
                          child: Text('Nghiêm trọng (HIGH)'),
                        ),
                        DropdownMenuItem(
                          value: 'CRITICAL',
                          child: Text('Nguy kịch (CRITICAL)'),
                        ),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() => severity = val);
                        }
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: reactionCtrl,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Triệu chứng phản ứng (tùy chọn)',
                        prefixIcon: Icon(
                          Icons.info_outline,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: Text(
                    'Hủy',
                    style: AppTypography.bodyStrong.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.brandPrimary,
                    foregroundColor: Colors.white,
                    shape: const RoundedRectangleBorder(
                      borderRadius: AppRadius.controlBorderRadius,
                    ),
                  ),
                  onPressed: () {
                    if (nameCtrl.text.trim().isNotEmpty) {
                      setState(() {
                        _allergies.add(
                          AllergyItem(
                            id: 'alg-${DateTime.now().millisecondsSinceEpoch}',
                            name: nameCtrl.text.trim(),
                            severity: severity,
                            reaction: reactionCtrl.text.trim().isEmpty
                                ? null
                                : reactionCtrl.text.trim(),
                          ),
                        );
                      });
                      Navigator.pop(ctx);
                    }
                  },
                  child: const Text('Thêm'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showAddConditionDialog() {
    final nameCtrl = TextEditingController();
    final medicationCtrl = TextEditingController();
    final notesCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.cardBorderRadius,
            side: const BorderSide(color: AppColors.border),
          ),
          title: Text(
            'Thêm bệnh lý / Điều kiện y tế',
            style: AppTypography.h3.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Tên bệnh lý / Điều kiện',
                    prefixIcon: Icon(
                      Icons.healing_outlined,
                      size: 20,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: medicationCtrl,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Thuốc đang sử dụng (tùy chọn)',
                    prefixIcon: Icon(
                      Icons.medication_outlined,
                      size: 20,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: notesCtrl,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Lưu ý đặc biệt (tùy chọn)',
                    prefixIcon: Icon(
                      Icons.description_outlined,
                      size: 20,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                'Hủy',
                style: AppTypography.bodyStrong.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brandPrimary,
                foregroundColor: Colors.white,
                shape: const RoundedRectangleBorder(
                  borderRadius: AppRadius.controlBorderRadius,
                ),
              ),
              onPressed: () {
                if (nameCtrl.text.trim().isNotEmpty) {
                  setState(() {
                    _medicalConditions.add(
                      MedicalConditionItem(
                        id: 'med-${DateTime.now().millisecondsSinceEpoch}',
                        name: nameCtrl.text.trim(),
                        medication: medicationCtrl.text.trim().isEmpty
                            ? null
                            : medicationCtrl.text.trim(),
                        notes: notesCtrl.text.trim().isEmpty
                            ? null
                            : notesCtrl.text.trim(),
                      ),
                    );
                  });
                  Navigator.pop(ctx);
                }
              },
              child: const Text('Thêm'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildTabBar() {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: AppColors.border, width: 1.0),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: () => setState(() => _activeTab = 0),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: _activeTab == 0
                          ? AppColors.brandPrimary
                          : Colors.transparent,
                      width: 2.5,
                    ),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.person_outline,
                      size: 18,
                      color: _activeTab == 0
                          ? AppColors.brandPrimary
                          : AppColors.textSecondary,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      'Hồ sơ cá nhân',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: _activeTab == 0
                            ? FontWeight.w700
                            : FontWeight.w500,
                        color: _activeTab == 0
                            ? AppColors.brandPrimary
                            : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: InkWell(
              onTap: () => setState(() => _activeTab = 1),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: _activeTab == 1
                          ? AppColors.brandPrimary
                          : Colors.transparent,
                      width: 2.5,
                    ),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.health_and_safety_outlined,
                      size: 18,
                      color: _activeTab == 1
                          ? AppColors.brandPrimary
                          : AppColors.textSecondary,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      'Thông tin y tế',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: _activeTab == 1
                            ? FontWeight.w700
                            : FontWeight.w500,
                        color: _activeTab == 1
                            ? AppColors.brandPrimary
                            : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileHeroCard(CamperProfile profile) {
    final name = profile.fullName.trim();
    final initial =
        name.isNotEmpty ? name.split(' ').last[0].toUpperCase() : 'C';

    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: AppColors.brandLight,
            child: Text(
              initial,
              style: AppTypography.h2.copyWith(
                color: AppColors.brandPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        name.isNotEmpty ? name : 'Hồ sơ Camper',
                        style: AppTypography.h3.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    const CtmsStatusBadge(
                      label: 'Camper',
                      status: CtmsStatus.success,
                      showDot: true,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(
                      Icons.email_outlined,
                      size: 14,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        profile.email ?? 'Chưa cập nhật email',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.textSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                if (profile.phone != null && profile.phone!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(
                        Icons.phone_outlined,
                        size: 14,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        profile.phone!,
                        style: AppTypography.caption.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHealthSummaryCard(HealthProfile healthProfile) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.brandLight,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.brandLightBorder),
            ),
            child: const Icon(
              Icons.health_and_safety_outlined,
              color: AppColors.brandPrimary,
              size: 26,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hồ sơ sức khỏe an toàn',
                  style: AppTypography.h3.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _isConsentGranted
                      ? 'Đang chia sẻ với HDV & Porter trong chuyến đi'
                      : 'Lưu nội bộ, chưa chia sẻ với đoàn trekking',
                  style: AppTypography.caption.copyWith(
                    color: _isConsentGranted
                        ? AppColors.brandPrimary
                        : AppColors.textSecondary,
                    fontWeight:
                        _isConsentGranted ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CtmsScaffold(
      title: 'Hồ sơ camper',
      subtitle: 'Quản lý thông tin cá nhân & dữ liệu y tế an toàn',
      body: Column(
        children: [
          _buildTabBar(),
          Expanded(
            child: IndexedStack(
              index: _activeTab,
              children: [_buildPersonalTab(), _buildHealthTab()],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPersonalTab() {
    final profileState = ref.watch(camperProfileControllerProvider);

    return profileState.when(
      loading: () => const CtmsLoadingState(message: 'Đang tải hồ sơ...'),
      error: (error, _) => _ProfileError(error: error, isHealth: false),
      data: (profile) {
        if (profile == null) {
          return _buildEmptyState();
        }

        _hydratePersonal(profile);
        return Form(
          key: _personalFormKey,
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.xxl),
            children: [
              // 1. Profile Hero Summary Card
              _buildProfileHeroCard(profile),

              const SizedBox(height: AppSpacing.xl),

              // 2. Personal Information Card
              CtmsSectionCard(
                title: 'Thông tin cá nhân',
                child: Column(
                  children: [
                    TextFormField(
                      controller: _accountEmail,
                      readOnly: true,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Email tài khoản',
                        prefixIcon: Icon(
                          Icons.email_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _accountPhone,
                      readOnly: true,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Số điện thoại tài khoản',
                        prefixIcon: Icon(
                          Icons.phone_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _fullName,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Họ và tên',
                        prefixIcon: Icon(
                          Icons.badge_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      validator: (value) => _minLength(value, 2),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _dateOfBirth,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Ngày sinh',
                        hintText: 'dd/mm/yyyy',
                        prefixIcon: Icon(
                          Icons.calendar_today_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      keyboardType: TextInputType.datetime,
                      validator: _date,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    DropdownButtonFormField<String>(
                      initialValue: _gender,
                      decoration: const InputDecoration(
                        labelText: 'Giới tính',
                        prefixIcon: Icon(
                          Icons.wc_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'male', child: Text('Nam')),
                        DropdownMenuItem(value: 'female', child: Text('Nữ')),
                        DropdownMenuItem(value: 'other', child: Text('Khác')),
                      ],
                      onChanged: _isSavingPersonal
                          ? null
                          : (value) =>
                              setState(() => _gender = value ?? 'male'),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _address,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Địa chỉ',
                        prefixIcon: Icon(
                          Icons.location_on_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      validator: (value) => _minLength(value, 5),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _bio,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Giới thiệu bản thân',
                        prefixIcon: Icon(
                          Icons.notes_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      maxLines: 3,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: AppSpacing.xl),

              // 3. Emergency Contacts Card
              CtmsSectionCard(
                title: 'Liên hệ khẩn cấp',
                trailing: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.brandLight,
                    borderRadius: AppRadius.pillBorderRadius,
                    border: Border.all(color: AppColors.brandLightBorder),
                  ),
                  child: Text(
                    '$_contactCount/2 người',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.brandPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                child: Column(
                  children: [
                    if (_contactCount == 0)
                      const CtmsAlertBanner(
                        severity: CtmsAlertSeverity.warning,
                        title: 'Chưa có liên hệ khẩn cấp',
                        message:
                            'Thêm người thân để hỗ trợ đội vận hành khi cần.',
                      ),
                    if (_contactCount >= 1)
                      _ContactFields(index: 1, state: this),
                    if (_contactCount >= 2) ...[
                      const SizedBox(height: AppSpacing.md),
                      _ContactFields(index: 2, state: this),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      children: [
                        if (_contactCount < 2)
                          Expanded(
                            child: CtmsButton(
                              label: 'Thêm liên hệ',
                              icon: Icons.add,
                              variant: CtmsButtonVariant.secondary,
                              onPressed: _isSavingPersonal
                                  ? null
                                  : () => setState(() => _contactCount++),
                            ),
                          ),
                        if (_contactCount > 0) ...[
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: CtmsButton(
                              label: 'Xóa bớt',
                              icon: Icons.delete_outline,
                              variant: CtmsButtonVariant.secondary,
                              onPressed: _isSavingPersonal
                                  ? null
                                  : () => setState(() => _contactCount--),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: AppSpacing.xl),

              // 4. Primary Save Button
              CtmsButton(
                label: _isSavingPersonal ? 'Đang lưu...' : 'Lưu hồ sơ cá nhân',
                icon: Icons.check_circle_outline,
                size: CtmsButtonSize.lg,
                isLoading: _isSavingPersonal,
                onPressed: _isSavingPersonal ? null : _savePersonal,
              ),

              const SizedBox(height: AppSpacing.xl),

              // 5. Offline Sync Card
              CtmsSectionCard(
                title: 'Đồng bộ & Ngoại tuyến',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.brandLight,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.brandLightBorder),
                    ),
                    child: const Icon(
                      Icons.sync_outlined,
                      color: AppColors.brandPrimary,
                      size: 20,
                    ),
                  ),
                  title: Text(
                    'Trạng thái đồng bộ thiết bị',
                    style: AppTypography.bodyStrong.copyWith(
                      color: AppColors.textPrimary,
                    ),
                  ),
                  subtitle: Text(
                    'Xem GPS và sự cố an toàn chờ tải lên máy chủ',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  trailing: const Icon(
                    Icons.chevron_right,
                    color: AppColors.textSecondary,
                  ),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const DeviceSyncStatusScreen(
                          tripId: 'a1736fee-62be-4991-9478-a62288e9b80a',
                        ),
                      ),
                    );
                  },
                ),
              ),

              const SizedBox(height: AppSpacing.xl),

              // 6. Account & Logout Card
              CtmsSectionCard(
                title: 'Tài khoản & Phiên đăng nhập',
                child: const LogoutActions(),
              ),

              const SizedBox(height: AppSpacing.xxxl),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHealthTab() {
    final healthState = ref.watch(camperHealthProfileControllerProvider);

    return healthState.when(
      loading: () =>
          const CtmsLoadingState(message: 'Đang tải thông tin y tế...'),
      error: (error, _) => _ProfileError(error: error, isHealth: true),
      data: (healthProfile) {
        if (healthProfile == null) {
          return _buildEmptyState();
        }

        _hydrateHealth(healthProfile);
        return Form(
          key: _healthFormKey,
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.xxl),
            children: [
              // 1. Health Summary Card
              _buildHealthSummaryCard(healthProfile),

              const SizedBox(height: AppSpacing.xl),

              // 2. Health & Fitness Metrics
              CtmsSectionCard(
                title: 'Chỉ số sức khỏe & Thể lực',
                child: Column(
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: _bloodType,
                      decoration: const InputDecoration(
                        labelText: 'Nhóm máu',
                        prefixIcon: Icon(
                          Icons.water_drop_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'A+', child: Text('A+')),
                        DropdownMenuItem(value: 'A-', child: Text('A-')),
                        DropdownMenuItem(value: 'B+', child: Text('B+')),
                        DropdownMenuItem(value: 'B-', child: Text('B-')),
                        DropdownMenuItem(value: 'AB+', child: Text('AB+')),
                        DropdownMenuItem(value: 'AB-', child: Text('AB-')),
                        DropdownMenuItem(value: 'O+', child: Text('O+')),
                        DropdownMenuItem(value: 'O-', child: Text('O-')),
                        DropdownMenuItem(
                          value: 'UNKNOWN',
                          child: Text('Chưa rõ / UNKNOWN'),
                        ),
                      ],
                      onChanged: _isSavingHealth
                          ? null
                          : (val) =>
                              setState(() => _bloodType = val ?? 'UNKNOWN'),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    DropdownButtonFormField<String>(
                      initialValue: _physicalFitnessLevel,
                      decoration: const InputDecoration(
                        labelText: 'Thể lực hiện tại',
                        prefixIcon: Icon(
                          Icons.fitness_center_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'BEGINNER',
                          child: Text('Mới bắt đầu (BEGINNER)'),
                        ),
                        DropdownMenuItem(
                          value: 'INTERMEDIATE',
                          child: Text('Trung bình (INTERMEDIATE)'),
                        ),
                        DropdownMenuItem(
                          value: 'ADVANCED',
                          child: Text('Khá / Tốt (ADVANCED)'),
                        ),
                        DropdownMenuItem(
                          value: 'EXPERT',
                          child: Text('Chuyên gia (EXPERT)'),
                        ),
                      ],
                      onChanged: _isSavingHealth
                          ? null
                          : (val) => setState(
                              () => _physicalFitnessLevel = val ?? 'BEGINNER',
                            ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _dietaryRestrictions,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Chế độ ăn kiêng / Dị ứng thực phẩm',
                        prefixIcon: Icon(
                          Icons.restaurant_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: _emergencyNotes,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Lưu ý y tế khẩn cấp',
                        prefixIcon: Icon(
                          Icons.emergency_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      maxLines: 3,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: AppSpacing.xl),

              // 3. Allergies List
              CtmsSectionCard(
                title: 'Danh sách dị ứng',
                trailing: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.brandLight,
                    borderRadius: AppRadius.pillBorderRadius,
                    border: Border.all(color: AppColors.brandLightBorder),
                  ),
                  child: Text(
                    '${_allergies.length} mục',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.brandPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_allergies.isEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                        alignment: Alignment.center,
                        child: Text(
                          'Chưa ghi nhận dị ứng nào.',
                          style: AppTypography.body.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      )
                    else
                      ..._allergies.map((item) {
                        return Container(
                          margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: AppSpacing.sm,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.brandBg,
                            borderRadius: AppRadius.controlBorderRadius,
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.warning_amber_rounded,
                                size: 20,
                                color: AppColors.statusWarning,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          item.name,
                                          style: AppTypography.bodyStrong.copyWith(
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        const SizedBox(width: AppSpacing.sm),
                                        _buildSeverityBadge(item.severity),
                                      ],
                                    ),
                                    if (item.reaction != null &&
                                        item.reaction!.isNotEmpty) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        'Phản ứng: ${item.reaction}',
                                        style: AppTypography.caption.copyWith(
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(
                                  Icons.delete_outline,
                                  color: AppColors.statusDanger,
                                  size: 20,
                                ),
                                onPressed: () {
                                  setState(() {
                                    _allergies.remove(item);
                                  });
                                },
                              ),
                            ],
                          ),
                        );
                      }),
                    const SizedBox(height: AppSpacing.md),
                    CtmsButton(
                      label: 'Thêm dị ứng',
                      icon: Icons.add,
                      variant: CtmsButtonVariant.secondary,
                      onPressed: _showAddAllergyDialog,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: AppSpacing.xl),

              // 4. Medical Conditions
              CtmsSectionCard(
                title: 'Bệnh lý / Thuốc điều trị',
                trailing: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.brandLight,
                    borderRadius: AppRadius.pillBorderRadius,
                    border: Border.all(color: AppColors.brandLightBorder),
                  ),
                  child: Text(
                    '${_medicalConditions.length} mục',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.brandPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_medicalConditions.isEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                        alignment: Alignment.center,
                        child: Text(
                          'Chưa ghi nhận bệnh lý nào.',
                          style: AppTypography.body.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      )
                    else
                      ..._medicalConditions.map((item) {
                        return Container(
                          margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: AppSpacing.sm,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.brandBg,
                            borderRadius: AppRadius.controlBorderRadius,
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.healing_outlined,
                                size: 20,
                                color: AppColors.brandPrimary,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.name,
                                      style: AppTypography.bodyStrong.copyWith(
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                    if (item.medication != null ||
                                        item.notes != null) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        [
                                          if (item.medication != null)
                                            'Thuốc: ${item.medication}',
                                          if (item.notes != null)
                                            'Lưu ý: ${item.notes}',
                                        ].join(' • '),
                                        style: AppTypography.caption.copyWith(
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(
                                  Icons.delete_outline,
                                  color: AppColors.statusDanger,
                                  size: 20,
                                ),
                                onPressed: () {
                                  setState(() {
                                    _medicalConditions.remove(item);
                                  });
                                },
                              ),
                            ],
                          ),
                        );
                      }),
                    const SizedBox(height: AppSpacing.md),
                    CtmsButton(
                      label: 'Thêm bệnh lý',
                      icon: Icons.add,
                      variant: CtmsButtonVariant.secondary,
                      onPressed: _showAddConditionDialog,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: AppSpacing.xl),

              // 5. Consent & Privacy
              CtmsSectionCard(
                title: 'Quyền chia sẻ thông tin',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Chia sẻ với ban tổ chức chuyến đi',
                                style: AppTypography.bodyStrong.copyWith(
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Cho phép Host & Porter của chuyến đi bạn đặt xem thông tin y tế để hỗ trợ sơ cứu kịp thời khi khẩn cấp.',
                                style: AppTypography.caption.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Switch(
                          value: _isConsentGranted,
                          activeThumbColor: AppColors.brandPrimary,
                          onChanged: _isSavingHealth
                              ? null
                              : (val) => _toggleConsent(val),
                        ),
                      ],
                    ),
                    if (healthProfile.consent.activeTripScope != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        decoration: BoxDecoration(
                          color: AppColors.brandLight,
                          borderRadius: AppRadius.controlBorderRadius,
                          border: Border.all(color: AppColors.brandLightBorder),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.info_outline,
                              size: 16,
                              color: AppColors.brandPrimary,
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: Text(
                                'Phạm vi áp dụng: ${healthProfile.consent.activeTripScope}',
                                style: AppTypography.caption.copyWith(
                                  color: AppColors.brandPrimary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: AppSpacing.xl),

              // 6. Primary Save Button
              CtmsButton(
                label: _isSavingHealth
                    ? 'Đang lưu...'
                    : 'Lưu thông tin sức khỏe',
                icon: Icons.check_circle_outline,
                size: CtmsButtonSize.lg,
                isLoading: _isSavingHealth,
                onPressed: _isSavingHealth ? null : _saveHealth,
              ),

              const SizedBox(height: AppSpacing.xxxl),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    return CtmsEmptyState(
      icon: Icons.person_off_outlined,
      title: 'Chưa có hồ sơ',
      message: 'Không tìm thấy dữ liệu hồ sơ cho phiên hiện tại.',
      action: CtmsButton(
        label: 'Đăng xuất',
        variant: CtmsButtonVariant.danger,
        onPressed: () => ref.read(authControllerProvider.notifier).logout(),
      ),
    );
  }
}

class _ProfileError extends ConsumerWidget {
  const _ProfileError({required this.error, required this.isHealth});

  final Object error;
  final bool isHealth;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return CtmsEmptyState(
      icon: Icons.error_outline,
      title: 'Không thể tải hồ sơ',
      message: error.toString(),
      action: CtmsButton(
        label: 'Thử lại',
        onPressed: () {
          if (isHealth) {
            ref.read(camperHealthProfileControllerProvider.notifier).refresh();
          } else {
            ref.read(camperProfileControllerProvider.notifier).refresh();
          }
        },
      ),
    );
  }
}

class _ContactFields extends StatelessWidget {
  const _ContactFields({required this.index, required this.state});

  final int index;
  final _CamperProfileScreenState state;

  @override
  Widget build(BuildContext context) {
    final name = index == 1 ? state._contact1Name : state._contact2Name;
    final relationship = index == 1
        ? state._contact1Relationship
        : state._contact2Relationship;
    final phone = index == 1 ? state._contact1Phone : state._contact2Phone;
    final email = index == 1 ? state._contact1Email : state._contact2Email;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.brandBg,
        borderRadius: AppRadius.controlBorderRadius,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.contact_phone_outlined,
                size: 16,
                color: AppColors.brandPrimary,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'Người liên hệ $index',
                style: AppTypography.bodyStrong.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: name,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 14,
            ),
            decoration: InputDecoration(
              labelText: 'Họ tên liên hệ $index',
              prefixIcon: const Icon(
                Icons.badge_outlined,
                size: 20,
                color: AppColors.textSecondary,
              ),
            ),
            validator: (value) => state._minLength(value, 2),
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: relationship,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 14,
            ),
            decoration: const InputDecoration(
              labelText: 'Mối quan hệ',
              prefixIcon: Icon(
                Icons.people_outline,
                size: 20,
                color: AppColors.textSecondary,
              ),
            ),
            validator: (value) => state._minLength(value, 2),
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: phone,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 14,
            ),
            decoration: const InputDecoration(
              labelText: 'Số điện thoại khẩn cấp',
              prefixIcon: Icon(
                Icons.phone_outlined,
                size: 20,
                color: AppColors.textSecondary,
              ),
            ),
            keyboardType: TextInputType.phone,
            validator: state._phone,
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: email,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 14,
            ),
            decoration: const InputDecoration(
              labelText: 'Email liên hệ',
              prefixIcon: Icon(
                Icons.alternate_email,
                size: 20,
                color: AppColors.textSecondary,
              ),
            ),
            keyboardType: TextInputType.emailAddress,
            validator: state._email,
          ),
        ],
      ),
    );
  }
}
