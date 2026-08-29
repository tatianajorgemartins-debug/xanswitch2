import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';
import { COOKIE_NAME } from './lib/auth';
import { incrementVisitCount } from './lib/db';

const VISITOR_COOKIE = 'xan_visitor_seen';

// "Thin proxy" pattern (Next.js 16 recommendation, after CVE-2025-29927 showed
// that auth decided purely in Middleware/Proxy could be bypassed under load):
// this only does a cheap, optimistic check — does the session cookie exist at
// all? — to bounce obviously-logged-out visitors to /login quickly. The real,
// authoritative check (verifying the cookie's signature) happens again inside
// the protected Server Components and Server Actions themselves, which are
// the actual source of truth for whether someone is allowed in.
export function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    return handleVisitCounting(request, event);
  }

  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  const hasCookie = Boolean(request.cookies.get(COOKIE_NAME)?.value);
  if (!hasCookie) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Counts a visit once per browser (a long-lived cookie marks "already
// counted"), and skips it entirely if this browser has an admin session —
// so the site owner checking their own catalog doesn't inflate the number.
// This can't distinguish the owner browsing from a browser that has never
// logged into /admin, but it covers the common case with no extra tracking.
function handleVisitCounting(request: NextRequest, event: NextFetchEvent) {
  const response = NextResponse.next();

  const isAdmin = Boolean(request.cookies.get(COOKIE_NAME)?.value);
  const alreadyCounted = Boolean(request.cookies.get(VISITOR_COOKIE)?.value);

  if (!isAdmin && !alreadyCounted) {
    response.cookies.set(VISITOR_COOKIE, '1', {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      httpOnly: true,
      sameSite: 'lax'
    });
    event.waitUntil(incrementVisitCount());
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    {
      source: '/',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' }
      ]
    }
  ]
};
