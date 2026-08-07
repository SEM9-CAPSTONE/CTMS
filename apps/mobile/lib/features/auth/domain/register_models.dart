import 'package:freezed_annotation/freezed_annotation.dart';

import 'user_role.dart';

part 'register_models.freezed.dart';

/// CTMS-01-T03 scope only — 4-step wizard matching exactly what
/// `POST /auth/register` (CTMS-01-T01) accepts: `email`, `phone`,
/// `password`, `role`. Mobile only offers [UserRole.camper]/
/// [UserRole.porter] at [role] (Host/Admin register on the web dashboard —
/// see `core/router/app_router.dart`).
///
/// A previous version of this wizard had a 5th "professional" step
/// (bloodType/fitnessLevel/emergencyContact for Camper; experienceYears/
/// operatingDistrict/campsites/certification for Porter) and a Porter-only
/// in-wizard phone-OTP step. Neither maps to any column the real `users`
/// table has, and the backend's global ValidationPipe
/// (`forbidNonWhitelisted: true`) rejects the request outright if those
/// fields are sent — so that step was removed rather than fixed. The
/// widgets for it still exist under `presentation/widgets/` (unreferenced,
/// not deleted) in case a later story reuses them for a profile-completion
/// flow.
enum RegisterStep { role, account, personal, verification }

/// Draft form data accumulated across the wizard. Never (de)serialized
/// directly — `AuthApi.register` reads these fields to build the request
/// payload, so this stays a plain freezed value type (no `fromJson`).
///
/// [fullName] is UI-only: the real `users` table has no such column, so it
/// is never sent to `POST /auth/register`, never stored on [AuthUser], and
/// never persisted to local storage or logs. It exists purely so the
/// Personal step can ask "what should we call you" without that value
/// going anywhere yet — a later profile-completion story can pick it back
/// up once there is somewhere on the backend to store it.
@freezed
abstract class RegisterFormData with _$RegisterFormData {
  const factory RegisterFormData({
    UserRole? role,
    @Default('') String email,
    @Default('') String password,
    @Default('') String fullName,
    @Default('') String phone,
    @Default(false) bool acceptedTerms,
  }) = _RegisterFormData;
}
