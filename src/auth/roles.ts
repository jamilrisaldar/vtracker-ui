import type { User } from '../types'

/** Matches `roles.name` from the API. */
export const ROLE = {
  Administrator: 'Administrator',
  Manager: 'Manager',
  ViewOnly: 'ViewOnly',
} as const

function roleNames(user: User | null | undefined): string[] {
  return user?.roles?.map((r) => r.name) ?? []
}

export function userHasRole(user: User | null | undefined, ...names: string[]): boolean {
  const set = new Set(roleNames(user))
  return names.some((n) => set.has(n))
}

export function canAccessProjects(user: User | null | undefined): boolean {
  return userHasRole(user, ROLE.Administrator, ROLE.Manager, ROLE.ViewOnly)
}

/** Mutations on project data (CRUD, uploads, etc.). */
export function canWriteProjects(user: User | null | undefined): boolean {
  return userHasRole(user, ROLE.Administrator, ROLE.Manager)
}

export function canAccessAccounts(user: User | null | undefined): boolean {
  return userHasRole(user, ROLE.Administrator)
}

export function canAccessAdmin(user: User | null | undefined): boolean {
  return userHasRole(user, ROLE.Administrator)
}
