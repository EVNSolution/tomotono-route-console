import { DEFAULT_ADMIN_IDENTIFIER } from '@/lib/auth';
import { findActiveAdminByIdentifier, verifyAdminPassword } from '@/lib/admin-auth';
import { createAdminLoginLog, createAdminSession, createAdminSessionCookie, generateSessionToken, getRequestMetadata } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function getLoginIdentifier(body: Record<string, unknown>) {
  const submitted = body.email ?? body.username ?? body.identifier;
  return typeof submitted === 'string' && submitted.trim() ? submitted.trim() : DEFAULT_ADMIN_IDENTIFIER;
}

export async function POST(request: Request) {
  const metadata = getRequestMetadata(request);
  let emailAttempted = DEFAULT_ADMIN_IDENTIFIER;

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    emailAttempted = getLoginIdentifier(body);
    const password = typeof body.password === 'string' ? body.password : '';
    const logMetadata = { ...metadata, emailAttempted };

    const admin = await findActiveAdminByIdentifier(emailAttempted);
    if (!admin || !admin.isActive) {
      await createAdminLoginLog({ ...logMetadata, adminUserId: null, eventType: 'login_failed', result: 'fail', failureReason: 'user_not_found' });
      return Response.json({ error: 'Invalid admin password.' }, { status: 401 });
    }

    if (!password || !verifyAdminPassword(password, admin.passwordHash)) {
      await createAdminLoginLog({ ...logMetadata, adminUserId: admin.id, eventType: 'login_failed', result: 'fail', failureReason: 'wrong_password' });
      return Response.json({ error: 'Invalid admin password.' }, { status: 401 });
    }

    const token = generateSessionToken();
    const session = await createAdminSession({ adminUserId: admin.id, token, ipAddress: metadata.ipAddress, userAgent: metadata.userAgent });
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    await createAdminLoginLog({ ...logMetadata, adminUserId: admin.id, eventType: 'login_success', result: 'success', sessionId: session.id });

    const response = Response.json({ ok: true });
    response.headers.append('Set-Cookie', createAdminSessionCookie(token));
    return response;
  } catch {
    await createAdminLoginLog({ ...metadata, emailAttempted, adminUserId: null, eventType: 'login_failed', result: 'fail', failureReason: 'unknown_error' }).catch(() => undefined);
    return Response.json({ error: 'Login failed.' }, { status: 500 });
  }
}
