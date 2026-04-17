import { getDefaultAdminSession, useAdminSession } from '../composables/useAdminSession'
import type { AdminSessionResponse } from '../../shared/imapsync'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  const session = useAdminSession()
  const response = await $fetch<AdminSessionResponse>('/api/auth/session').catch(() => getDefaultAdminSession())

  session.value = response

  if (to.path === '/login') {
    if (response.authenticated) {
      return navigateTo('/')
    }

    return
  }

  if (!response.authenticated) {
    return navigateTo('/login')
  }
})
