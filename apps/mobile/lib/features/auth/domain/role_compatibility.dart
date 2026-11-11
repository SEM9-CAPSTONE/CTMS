import 'user_role.dart';

/// Which [UserRole]s one Account is allowed to hold at once.
///
/// Trekker ⇄ Porter is fine — plenty of guides are also trekkers in their
/// own time. Host ⇄ Porter is not: Host is the party that coordinates a
/// trip and handles incidents, so Host can never simultaneously be the
/// Porter out in the field with no one left to supervise/escalate to.
///
/// Not wired into any UI yet — registration today only ever creates a
/// brand-new single-role account, and there's no "look up my existing
/// account's roles" endpoint for it to check against. This is the single
/// source of truth to call once an "add a role to my account" flow exists.
class RoleCompatibility {
  RoleCompatibility._();

  static bool canAddRole(List<UserRole> existingRoles, UserRole newRole) {
    final wouldHaveHost = newRole == UserRole.host || existingRoles.contains(UserRole.host);
    final wouldHavePorter = newRole == UserRole.porter || existingRoles.contains(UserRole.porter);
    return !(wouldHaveHost && wouldHavePorter);
  }
}
