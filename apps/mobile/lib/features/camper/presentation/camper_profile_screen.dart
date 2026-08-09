import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_loading_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../profile/application/camper_profile_controller.dart';
import '../profile/domain/camper_profile.dart';
import '../../auth/application/auth_controller.dart';

class CamperProfileScreen extends ConsumerStatefulWidget {
  const CamperProfileScreen({super.key});

  @override
  ConsumerState<CamperProfileScreen> createState() => _CamperProfileScreenState();
}

class _CamperProfileScreenState extends ConsumerState<CamperProfileScreen> {
  final _formKey = GlobalKey<FormState>();
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
  bool _isSaving = false;

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
    super.dispose();
  }

  void _hydrate(CamperProfile profile) {
    if (_loadedProfileId == profile.id) return;
    _loadedProfileId = profile.id;
    _fullName.text = profile.fullName;
    _dateOfBirth.text = profile.dateOfBirth;
    _gender = profile.gender;
    _address.text = profile.address;
    _bio.text = profile.bio;
    _contactCount = profile.emergencyContacts.length > 2 ? 2 : profile.emergencyContacts.length;
    if (_contactCount > 0) _fillContact(profile.emergencyContacts[0], 1);
    if (_contactCount > 1) _fillContact(profile.emergencyContacts[1], 2);
  }

  void _fillContact(EmergencyContact contact, int index) {
    final name = index == 1 ? _contact1Name : _contact2Name;
    final relationship = index == 1 ? _contact1Relationship : _contact2Relationship;
    final phone = index == 1 ? _contact1Phone : _contact2Phone;
    final email = index == 1 ? _contact1Email : _contact2Email;
    name.text = contact.name;
    relationship.text = contact.relationship;
    phone.text = contact.phone;
    email.text = contact.email ?? '';
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

  List<EmergencyContact> _contactsFromForm() {
    final contacts = <EmergencyContact>[];
    if (_contactCount >= 1) {
      contacts.add(
        EmergencyContact(
          name: _contact1Name.text.trim(),
          relationship: _contact1Relationship.text.trim(),
          phone: _contact1Phone.text.trim(),
          email: _contact1Email.text.trim().isEmpty ? null : _contact1Email.text.trim(),
        ),
      );
    }
    if (_contactCount >= 2) {
      contacts.add(
        EmergencyContact(
          name: _contact2Name.text.trim(),
          relationship: _contact2Relationship.text.trim(),
          phone: _contact2Phone.text.trim(),
          email: _contact2Email.text.trim().isEmpty ? null : _contact2Email.text.trim(),
        ),
      );
    }
    return contacts;
  }

  Future<void> _save() async {
    if (_isSaving || !(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _isSaving = true);
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
    setState(() => _isSaving = false);
    if (success) {
      _loadedProfileId = null;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Hồ sơ đã được lưu thành công')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileState = ref.watch(camperProfileControllerProvider);

    return CtmsScaffold(
      title: 'Hồ sơ',
      body: profileState.when(
        loading: () => const CtmsLoadingState(message: 'Đang tải hồ sơ...'),
        error: (error, _) => _ProfileError(error: error),
        data: (profile) {
          if (profile == null) {
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

          _hydrate(profile);
          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                CtmsSectionCard(
                  title: 'Thông tin cá nhân',
                  child: Column(
                    children: [
                      TextFormField(
                        controller: TextEditingController(text: profile.email ?? ''),
                        readOnly: true,
                        decoration: const InputDecoration(labelText: 'Email tài khoản'),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: TextEditingController(text: profile.phone ?? ''),
                        readOnly: true,
                        decoration: const InputDecoration(labelText: 'Số điện thoại tài khoản'),
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
                        decoration: const InputDecoration(labelText: 'Ngày sinh YYYY-MM-DD'),
                        validator: _required,
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
                        onChanged: _isSaving ? null : (value) => setState(() => _gender = value ?? 'male'),
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
                        decoration: const InputDecoration(labelText: 'Giới thiệu'),
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
                          message: 'Thêm người thân để hỗ trợ đội vận hành khi cần.',
                        ),
                      if (_contactCount >= 1) _ContactFields(index: 1, state: this),
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
                                onPressed: _isSaving ? null : () => setState(() => _contactCount++),
                              ),
                            ),
                          if (_contactCount > 0) ...[
                            const SizedBox(width: 12),
                            Expanded(
                              child: CtmsButton(
                                label: 'Xóa liên hệ',
                                icon: Icons.delete_outline,
                                variant: CtmsButtonVariant.ghost,
                                onPressed: _isSaving ? null : () => setState(() => _contactCount--),
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
                  label: _isSaving ? 'Đang lưu...' : 'Lưu thay đổi',
                  icon: Icons.save_outlined,
                  size: CtmsButtonSize.lg,
                  isLoading: _isSaving,
                  onPressed: _isSaving ? null : _save,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ProfileError extends ConsumerWidget {
  const _ProfileError({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return CtmsEmptyState(
      icon: Icons.error_outline,
      title: 'Không thể tải hồ sơ',
      message: error.toString(),
      action: CtmsButton(
        label: 'Thử lại',
        onPressed: () => ref.read(camperProfileControllerProvider.notifier).refresh(),
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
    final relationship = index == 1 ? state._contact1Relationship : state._contact2Relationship;
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
          decoration: const InputDecoration(labelText: 'Số điện thoại khẩn cấp'),
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
