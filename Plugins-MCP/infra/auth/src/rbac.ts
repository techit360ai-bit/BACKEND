/**
 * infra/auth/rbac — human role hierarchy.
 *
 * Roles are totally ordered: viewer < editor < admin < owner. An action declares
 * the minimum role it requires; `roleSatisfies` checks the acting human.
 */

import type { Role } from '@techit/core';

const ORDER: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function roleRank(role: Role): number {
  return ORDER[role];
}

export function roleSatisfies(actual: Role, required: Role): boolean {
  return roleRank(actual) >= roleRank(required);
}
