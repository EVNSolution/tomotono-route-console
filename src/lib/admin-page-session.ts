import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/auth';
import { validateAdminSessionToken } from '@/lib/admin-session';

export async function requireAdminPageSession(pathname: string) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const result = await validateAdminSessionToken(
    token,
    {
      ipAddress: headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() || headerStore.get('x-real-ip'),
      userAgent: headerStore.get('user-agent'),
      requestPath: pathname,
      requestMethod: 'GET',
    },
    { logInvalid: true },
  );

  if (!result.ok) redirect(`/login?next=${encodeURIComponent(pathname)}`);
  return result.session;
}
