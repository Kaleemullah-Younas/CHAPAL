import { betterFetch } from '@better-fetch/fetch';
import { NextResponse, type NextRequest } from 'next/server';
import type { Session } from 'better-auth/types';

type UserWithRole = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: 'user' | 'admin';
  isBlocked?: boolean;
};

export default async function authMiddleware(request: NextRequest) {
  const { data: sessionData } = await betterFetch<{
    session: Session;
    user: UserWithRole;
  }>('/api/auth/get-session', {
    baseURL: request.nextUrl.origin,
    headers: {
      // get the cookie from the request
      cookie: request.headers.get('cookie') || '',
    },
  });

  const isUserAuthPage = [
    '/signin',
    '/signup',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
  ].some(path => request.nextUrl.pathname.startsWith(path));
  const isAdminAuthPage = request.nextUrl.pathname.startsWith('/admin/signin');
  const isAdminPage =
    request.nextUrl.pathname.startsWith('/admin') && !isAdminAuthPage;
  const isHomePage = request.nextUrl.pathname === '/';
  const isPublicPage = isHomePage; // Landing page
  const isBlockedPage = request.nextUrl.pathname === '/blocked';

  // Check if user is blocked - redirect to blocked page
  if (sessionData && sessionData.user.isBlocked && !isBlockedPage) {
    // Allow API routes for signout
    if (!request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.redirect(new URL('/blocked', request.url));
    }
  }

  // Redirect admin users from home to admin dashboard
  if (
    isHomePage &&
    sessionData &&
    sessionData.user.role === 'admin' &&
    sessionData.user.emailVerified
  ) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Handle admin routes
  if (isAdminPage) {
    if (!sessionData) {
      return NextResponse.redirect(new URL('/admin/signin', request.url));
    }
    if (sessionData.user.role !== 'admin') {
      // Non-admin trying to access admin pages
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Admin is authenticated, allow access
    return NextResponse.next();
  }

  // Handle admin signin page
  if (isAdminAuthPage) {
    if (sessionData && sessionData.user.role === 'admin') {
      // Already logged in as admin, redirect to admin dashboard
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    // If logged in as regular user, allow them to see admin signin (they'll need to use admin credentials)
    return NextResponse.next();
  }

  if (!sessionData && !isUserAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  if (sessionData) {
    // Enforce Email Verification
    if (
      !sessionData.user.emailVerified &&
      !request.nextUrl.pathname.startsWith('/verify-email') &&
      !request.nextUrl.pathname.startsWith('/api')
    ) {
      return NextResponse.redirect(new URL('/verify-email', request.url));
    }

    // If logged in and on auth page, redirect to dashboard
    // Also redirect FROM /verify-email if ALREADY verified (and not verifying via token?)
    // Actually if they have a token, we might want to let them stay?
    // But the user asked "if user is verified, /verify-email should redirect to /"
    if (
      sessionData.user.emailVerified &&
      request.nextUrl.pathname.startsWith('/verify-email')
    ) {
      // Exception: If processing a token, they might want to see "Verified!"?
      // But usually if verified, they are good.
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (
      isUserAuthPage &&
      !request.nextUrl.pathname.startsWith('/reset-password') &&
      !request.nextUrl.pathname.startsWith('/verify-email')
    ) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

//
