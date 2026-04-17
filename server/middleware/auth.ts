import { createError, defineEventHandler, getRequestURL, sendRedirect } from 'h3'
import { getAdminSession } from '../utils/auth'

function isPublicPath(pathname: string) {
  if (pathname === '/favicon.ico' || pathname === '/robots.txt') {
    return true
  }

  return pathname.startsWith('/_nuxt')
    || pathname.startsWith('/__nuxt')
    || pathname.startsWith('/_ipx')
}

function isPublicApiPath(pathname: string) {
  return pathname === '/api/auth/login'
    || pathname === '/api/auth/logout'
    || pathname === '/api/auth/session'
}

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname

  if (event.method === 'OPTIONS' || isPublicPath(pathname) || isPublicApiPath(pathname)) {
    return
  }

  const session = getAdminSession(event)

  if (session) {
    if (pathname === '/login') {
      return sendRedirect(event, '/')
    }

    return
  }

  if (pathname === '/login') {
    return
  }

  if (pathname.startsWith('/api/')) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required.' })
  }

  return sendRedirect(event, '/login')
})
