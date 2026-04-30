import { ADMIN_PASSWORD, SESSION_COOKIE, SESSION_VALUE } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.password !== ADMIN_PASSWORD) return Response.json({ error: 'Invalid admin password.' }, { status: 401 });
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', `${SESSION_COOKIE}=${SESSION_VALUE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`);
  return response;
}
