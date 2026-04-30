import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_VALUE } from '@/lib/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicPath = pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.startsWith('/_next') || pathname === '/favicon.ico';
  if (publicPath) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)?.value === SESSION_VALUE) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!.*\\..*).*)', '/api/:path*'] };
