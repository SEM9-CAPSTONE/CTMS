import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_loading_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../profile/application/camper_profile_controller.dart';
import '../profile/application/camper_health_profile_controller.dart';
import '../profile/domain/camper_profile.dart';
import '../profile/domain/health_profile.dart';
import '../../auth/application/auth_controller.dart';

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
              title: const Text('Thêm dị ứng'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Tên dị ứng / Chất gây dị ứng',
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: severity,
                    decoration: const InputDecoration(
                      labelText: 'Mức độ nghiêm trọng',
                    ),
                    items: const [
                      DropdownMenuItem(value: 'LOW', child: Text('Nhẹ (LOW)')),
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
                  const SizedBox(height: 12),
                  TextField(
                    controller: reactionCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Triệu chứng phản ứng (tùy chọn)',
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Hủy'),
                ),
                TextButton(
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
          title: const Text('Thêm bệnh lý / Điều kiện y tế'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(
                  labelText: 'Tên bệnh lý / Điều kiện',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: medicationCtrl,
                decoration: const InputDecoration(
                  labelText: 'Thuốc đang sử dụng (tùy chọn)',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notesCtrl,
                decoration: const InputDecoration(
                  labelText: 'Lưu ý đặc biệt (tùy chọn)',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Hủy'),
            ),
            TextButton(
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

  @override
  Widget build(BuildContext context) {
    return CtmsScaffold(
      title: 'Hồ sơ camper',
      actions: [
        IconButton(
          tooltip: 'Đăng xuất',
          icon: const Icon(Icons.logout),
          onPressed: () => ref.read(authControllerProvider.notifier).logout(),
        ),
      ],
      body: Column(
        children: [
          // Elegant Custom Tab Header
          Container(
            color: Colors.white,
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _activeTab = 0),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: _activeTab == 0
                                ? const Color(0xFF164027)
                                : Colors.transparent,
                            width: 2.5,
                          ),
                        ),
                      ),
                      child: Text(
                        'Hồ sơ cá nhân',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontWeight: _activeTab == 0
                              ? FontWeight.bold
                              : FontWeight.normal,
                          color: _activeTab == 0
                              ? const Color(0xFF164027)
                              : Colors.grey[600],
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _activeTab = 1),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: _activeTab == 1
                                ? const Color(0xFF164027)
                                : Colors.transparent,
                            width: 2.5,
                          ),
                        ),
                      ),
                      child: Text(
                        'Thông tin y tế',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontWeight: _activeTab == 1
                              ? FontWeight.bold
                              : FontWeight.normal,
                          color: _activeTab == 1
                              ? const Color(0xFF164027)
                              : Colors.grey[600],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
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
            padding: const EdgeInsets.all(16),
            children: [
              CtmsSectionCard(
                title: 'Thông tin cá nhân',
                child: Column(
                  children: [
                    TextFormField(
                      controller: TextEditingController(
                        text: profile.email ?? '',
                      ),
                      readOnly: true,
                      decoration: const InputDecoration(
                        labelText: 'Email tài khoản',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: TextEditingController(
                        text: profile.phone ?? '',
                      ),
                      readOnly: true,
                      decoration: const InputDecoration(
                        labelText: 'Số điện thoại tài khoản',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _fullName,
                      decoration: const InputDecoration(labelText: 'Họ và tên'),
                      validator: (value) => _minLength(value, 2),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _dateOfBirth,
                      decoration: const InputDecoration(
                        labelText: 'Ngày sinh',
                        hintText: 'dd/mm/yyyy',
                      ),
                      keyboardType: TextInputType.datetime,
                      validator: _date,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _gender,
                      decoration: const InputDecoration(labelText: 'Giới tính'),
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
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _address,
                      decoration: const InputDecoration(labelText: 'Địa chỉ'),
                      validator: (value) => _minLength(value, 5),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _bio,
                      decoration: const InputDecoration(
                        labelText: 'Giới thiệu',
                      ),
                      maxLines: 3,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              CtmsSectionCard(
                title: 'Liên hệ khẩn cấp',
                trailing: Text('$_contactCount/2'),
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
                      const SizedBox(height: 12),
                      _ContactFields(index: 2, state: this),
                    ],
                    const SizedBox(height: 12),
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
                          const SizedBox(width: 12),
                          Expanded(
                            child: CtmsButton(
                              label: 'Xóa liên hệ',
                              icon: Icons.delete_outline,
                              variant: CtmsButtonVariant.ghost,
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
              const SizedBox(height: 16),
              CtmsButton(
                label: _isSavingPersonal ? 'Đang lưu...' : 'Lưu thay đổi',
                icon: Icons.save_outlined,
                size: CtmsButtonSize.lg,
                isLoading: _isSavingPersonal,
                onPressed: _isSavingPersonal ? null : _savePersonal,
              ),
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
            padding: const EdgeInsets.all(16),
            children: [
              CtmsSectionCard(
                title: 'Chỉ số sức khỏe & Thể lực',
                child: Column(
                  children: [
                    DropdownButtonFormField<String>(
                      value: _bloodType,
                      decoration: const InputDecoration(labelText: 'Nhóm máu'),
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
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _physicalFitnessLevel,
                      decoration: const InputDecoration(labelText: 'Thể lực'),
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
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _dietaryRestrictions,
                      decoration: const InputDecoration(
                        labelText: 'Chế độ ăn kiêng / Dị ứng thực phẩm',
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _emergencyNotes,
                      decoration: const InputDecoration(
                        labelText: 'Lưu ý y tế khẩn cấp',
                      ),
                      maxLines: 3,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              CtmsSectionCard(
                title: 'Danh sách dị ứng',
                trailing: Text('${_allergies.length} mục'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_allergies.isEmpty)
                      const Text(
                        'Chưa ghi nhận dị ứng nào.',
                        style: TextStyle(color: Colors.grey, fontSize: 13),
                      )
                    else
                      ..._allergies.map((item) {
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text('${item.name} (${item.severity})'),
                          subtitle: item.reaction != null
                              ? Text('Phản ứng: ${item.reaction}')
                              : null,
                          trailing: IconButton(
                            icon: const Icon(
                              Icons.delete_outline,
                              color: Colors.red,
                            ),
                            onPressed: () {
                              setState(() {
                                _allergies.remove(item);
                              });
                            },
                          ),
                        );
                      }),
                    const SizedBox(height: 12),
                    CtmsButton(
                      label: 'Thêm dị ứng',
                      icon: Icons.add,
                      variant: CtmsButtonVariant.secondary,
                      onPressed: _showAddAllergyDialog,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              CtmsSectionCard(
                title: 'Bệnh lý / Thuốc điều trị',
                trailing: Text('${_medicalConditions.length} mục'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_medicalConditions.isEmpty)
                      const Text(
                        'Chưa ghi nhận bệnh lý nào.',
                        style: TextStyle(color: Colors.grey, fontSize: 13),
                      )
                    else
                      ..._medicalConditions.map((item) {
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(item.name),
                          subtitle:
                              (item.medication != null || item.notes != null)
                              ? Text(
                                  [
                                    if (item.medication != null)
                                      'Thuốc: ${item.medication}',
                                    if (item.notes != null)
                                      'Lưu ý: ${item.notes}',
                                  ].join(' | '),
                                )
                              : null,
                          trailing: IconButton(
                            icon: const Icon(
                              Icons.delete_outline,
                              color: Colors.red,
                            ),
                            onPressed: () {
                              setState(() {
                                _medicalConditions.remove(item);
                              });
                            },
                          ),
                        );
                      }),
                    const SizedBox(height: 12),
                    CtmsButton(
                      label: 'Thêm bệnh lý',
                      icon: Icons.add,
                      variant: CtmsButtonVariant.secondary,
                      onPressed: _showAddConditionDialog,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              CtmsSectionCard(
                title: 'Quyền chia sẻ thông tin',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Expanded(
                          child: Text(
                            'Cho phép Host & Porter của chuyến đi bạn đặt xem thông tin y tế để hỗ trợ khi khẩn cấp.',
                            style: TextStyle(fontSize: 13),
                          ),
                        ),
                        Switch(
                          value: _isConsentGranted,
                          activeColor: const Color(0xFF164027),
                          onChanged: _isSavingHealth
                              ? null
                              : (val) => _toggleConsent(val),
                        ),
                      ],
                    ),
                    if (healthProfile.consent.activeTripScope != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Chia sẻ hiện tại giới hạn trong phạm vi chuyến đi: ${healthProfile.consent.activeTripScope}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontStyle: FontStyle.italic,
                          color: Colors.green,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              CtmsButton(
                label: _isSavingHealth
                    ? 'Đang lưu...'
                    : 'Lưu thông tin sức khỏe',
                icon: Icons.save_outlined,
                size: CtmsButtonSize.lg,
                isLoading: _isSavingHealth,
                onPressed: _isSavingHealth ? null : _saveHealth,
              ),
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

    return Column(
      children: [
        TextFormField(
          controller: name,
          decoration: InputDecoration(labelText: 'Họ tên liên hệ $index'),
          validator: (value) => state._minLength(value, 2),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: relationship,
          decoration: const InputDecoration(labelText: 'Mối quan hệ'),
          validator: (value) => state._minLength(value, 2),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: phone,
          decoration: const InputDecoration(
            labelText: 'Số điện thoại khẩn cấp',
          ),
          keyboardType: TextInputType.phone,
          validator: state._phone,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: email,
          decoration: const InputDecoration(labelText: 'Email liên hệ'),
          keyboardType: TextInputType.emailAddress,
          validator: state._email,
        ),
      ],
    );
  }
}
