import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from './lib/auth';

// "Thin proxy" pattern (Next.js 16 recommendation, after CVE-2025-29927 showed
// that auth decided purely in Middleware/Proxy could be bypassed under load):
// this only does a cheap, optimistic check — does the session cookie exist at
// all? — to bounce obviously-logged-out visitors to /login quickly. The real,
// authoritative check (verifying the cookie's signature) happens again inside
// the protected Server Components and Server Actions themselves, which are
// the actual source of truth for whether someone is allowed in.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

export const config = {
  matcher: ['/admin/:path*']
};
