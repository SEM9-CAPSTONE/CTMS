import 'package:freezed_annotation/freezed_annotation.dart';

import 'user_role.dart';

part 'register_models.freezed.dart';

/// §A.3 in `docs/design/FIGMA-SCREEN-INVENTORY.md` — the 5-step stepper.
/// Mobile only offers [UserRole.camper]/[UserRole.porter] at [role] (Host/
/// Admin register on the web dashboard — see `core/router/app_router.dart`).
enum RegisterStep { role, account, personal, professional, verification }

/// Draft form data accumulated across the wizard. Never (de)serialized
/// directly — `AuthApi.register` reads these fields to build the request
/// payload, so this stays a plain freezed value type (no `fromJson`).
@freezed
abstract class RegisterFormData with _$RegisterFormData {
  const factory RegisterFormData({
    UserRole? role,
    @Default('') String email,
    @Default('') String password,
    @Default('') String fullName,
    @Default('') String phone,
    // Trekker-only (all optional, mirrors CamperRegisterFormData on web).
    String? bloodType,
    String? fitnessLevel,
    String? emergencyContactName,
    String? emergencyContactPhone,
    // Porter-only — Step 3 "Thông tin cá nhân & xác thực". Every field
    // here maps 1:1 to a `users` column (dateOfBirth -> dob, gender ->
    // gender, phoneVerifiedAt -> phone_verified_at) — current business
    // rules keep CCCD/OCR/selfie/emergency-contact/avatar out of signup
    // entirely (avatar is set later, from the profile screen).
    DateTime? dateOfBirth,
    String? gender,
    DateTime? phoneVerifiedAt,
    // Porter-only — Step 4 "Kinh nghiệm & phạm vi hỗ trợ". A Porter isn't
    // tied to one campsite — they cover whichever Host-managed locations
    // they know the terrain for, within one district at a time (see
    // PorterCoverageRepository).
    int? experienceYears,
    String? operatingDistrictId,
    @Default(<String>[]) List<String> preferredCampsiteIds,
    String? certificationCode,
    @Default(false) bool acceptedTerms,
  }) = _RegisterFormData;
}
