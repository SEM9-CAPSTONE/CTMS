import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/synced_map_member.dart';

class SyncedMemberPin extends StatelessWidget {
  const SyncedMemberPin({
    super.key,
    required this.member,
    required this.onTap,
    this.selected = false,
  });
  final SyncedMapMember member;
  final VoidCallback onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final color = member.offRoute
        ? AppColors.statusDanger
        : member.stale
        ? AppColors.statusWarning
        : AppColors.statusInfo;
    final description =
        '${member.label} · ${member.routeLabel}'
        '${member.stale ? ' · Vị trí cũ' : ''}';
    return Semantics(
      button: true,
      label: description,
      child: Tooltip(
        message: description,
        child: Material(
          color: color,
          shape: CircleBorder(
            side: BorderSide(
              color: selected ? AppColors.brandPrimary : Colors.white,
              width: selected ? 3 : 2,
            ),
          ),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: Center(
              child: Text(
                member.label.trim().split(RegExp(r'\s+')).last.characters.first,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
