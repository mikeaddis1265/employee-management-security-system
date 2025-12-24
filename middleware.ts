import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from './lib/auth-edge'

// Public routes that don't require authentication
const publicRoutes = ['/', '/login', '/register', '/verify', '/access-denied']

// Role-based route protection
const roleBasedRoutes = {
  // Admin only routes
  ADMIN_ONLY: ['/admin', '/logs'],
  // HR and Admin can access
  HR_AND_ADMIN: ['/payroll', '/employees'],
  // All authenticated users
  ALL_USERS: ['/dashboard', '/resources', '/profile', '/leave'],
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the route is public
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route))

  // Get auth token from cookie
  const token = request.cookies.get('auth_token')?.value

  // If accessing a public route, allow
  if (isPublicRoute) {
    // If logged in and trying to access login/register, redirect to dashboard
    if (token && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Protected routes require authentication
  if (!token) {
    // Redirect to login if not authenticated
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify JWT token
  const payload = verifyToken(token)
  if (!payload) {
    // Token invalid or expired, redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_token')
    return response
  }

  // Check role-based access control
  const userRole = payload.role as string

  // Log for debugging (remove in production)
  console.log(`[MIDDLEWARE] Path: ${pathname}, User Role: ${userRole}`)

  // Admin-only routes
  const isAdminRoute = roleBasedRoutes.ADMIN_ONLY.some(route => pathname.startsWith(route))
  if (isAdminRoute && userRole !== 'ADMIN') {
    console.log(`[MIDDLEWARE] BLOCKED: Admin route accessed by ${userRole}`)
    const url = new URL('/access-denied', request.url)
    url.searchParams.set('reason', 'admin_only')
    url.searchParams.set('attempted', pathname)
    return NextResponse.redirect(url)
  }

  // HR and Admin routes (payroll, employees)
  const isHRRoute = roleBasedRoutes.HR_AND_ADMIN.some(route => pathname.startsWith(route))
  if (isHRRoute && !['HR', 'ADMIN'].includes(userRole)) {
    console.log(`[MIDDLEWARE] BLOCKED: HR route ${pathname} accessed by ${userRole}`)
    const url = new URL('/access-denied', request.url)
    url.searchParams.set('reason', 'hr_only')
    url.searchParams.set('attempted', pathname)
    return NextResponse.redirect(url)
  }

  // Add user info to request headers for server components
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', payload.userId)
  requestHeaders.set('x-user-role', payload.role)
  requestHeaders.set('x-user-username', payload.username)

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
