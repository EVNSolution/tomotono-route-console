import { authenticateAdminPassword } from '@/lib/admin-auth';
import { ADMIN_PASSWORD, SESSION_COOKIE, SESSION_VALUE } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const dbAuthenticated = typeof body.password === 'string' ? await authenticateAdminPassword(body.password) : false;
  const fallbackAuthenticated = !dbAuthenticated && process.env.ALLOW_ENV_ADMIN_PASSWORD_FALLBACK === 'true' && body.password === ADMIN_PASSWORD;
  if (!dbAuthenticated && !fallbackAuthenticated) return Response.json({ error: 'Invalid admin password.' }, { status: 401 });
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', `${SESSION_COOKIE}=${SESSION_VALUE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`);
  return response;
}
