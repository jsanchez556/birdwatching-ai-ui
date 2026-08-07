export const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  CUSTOMER: 'customer',
  GUIDE: 'tour guide',
})

export const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLES))
export const canManageTours = (role) => role === USER_ROLES.ADMIN || role === USER_ROLES.GUIDE

export function userRoleLabel(role) {
  if (role === USER_ROLES.ADMIN) return 'Administrator'
  if (role === USER_ROLES.GUIDE) return 'Guide'
  return 'Customer'
}
