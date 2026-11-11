import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_status_badge.dart';
import '../../domain/user_role.dart';
import '../register_strings.dart';
import 'role_selection_card.dart';

/// Step 1 — Vai trò. Only Camper/Porter are offered: Host registers on the
/// web dashboard (`core/router/app_router.dart` scopes this app to
/// Camper/Porter), so its Figma `RoleSelectionCard` has no mobile slot.
class RegisterRoleStep extends StatelessWidget {
  const RegisterRoleStep({super.key, required this.selectedRole, required this.onSelect});

  final UserRole? selectedRole;
  final ValueChanged<UserRole> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(RegisterStrings.roleStepTitle, style: AppTypography.h2),
        const SizedBox(height: AppSpacing.xxl),
        RoleSelectionCard(
          icon: Icons.hiking_outlined,
          title: RegisterStrings.camperTitle,
          description: RegisterStrings.camperDescription,
          benefits: RegisterStrings.camperBenefits,
          isSelected: selectedRole == UserRole.camper,
          onTap: () => onSelect(UserRole.camper),
        ),
        const SizedBox(height: AppSpacing.lg),
        RoleSelectionCard(
          icon: Icons.backpack_outlined,
          title: RegisterStrings.porterTitle,
          description: RegisterStrings.porterDescription,
          benefits: RegisterStrings.porterBenefits,
          badgeLabel: RegisterStrings.porterBadge,
          badgeStatus: CtmsStatus.info,
          isSelected: selectedRole == UserRole.porter,
          onTap: () => onSelect(UserRole.porter),
        ),
      ],
    );
  }
}
