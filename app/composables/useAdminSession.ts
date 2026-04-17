import type { AdminSessionResponse } from '../../shared/imapsync'

const defaultAdminSessionState: AdminSessionResponse = {
  authenticated: false,
  user: null,
}

export function useAdminSession() {
  return useState<AdminSessionResponse>('admin-session', () => ({ ...defaultAdminSessionState }))
}

export function getDefaultAdminSession() {
  return { ...defaultAdminSessionState }
}
