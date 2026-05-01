import { clearAdminSessionCookie } from '@/lib/admin-session';
import { getAdminSessionTokenFromRequest, getRequestMetadata, revokeAdminSession } from '@/lib/admin-session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  await revokeAdminSession(getAdminSessionTokenFromRequest(request), getRequestMetadata(request));
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', clearAdminSessionCookie());
  return response;
}
