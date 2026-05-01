import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { ADMIN_SESSION_MAX_AGE_SECONDS, SESSION_COOKIE } from '@/lib/auth';

export const ADMIN_LOGIN_EVENT_TYPES = ['login_success', 'login_failed', 'logout', 'session_expired', 'session_revoked', 'invalid_session'] as const;
export const ADMIN_LOGIN_RESULTS = ['success', 'fail'] as const;
export const ADMIN_LOGIN_FAILURE_REASONS = ['user_not_found', 'wrong_password', 'missing_cookie', 'invalid_session', 'expired_session', 'revoked_session', 'unknown_error'] as const;

export type AdminLoginEventType = (typeof ADMIN_LOGIN_EVENT_TYPES)[number];
export type AdminLoginResult = (typeof ADMIN_LOGIN_RESULTS)[number];
export type AdminLoginFailureReason = (typeof ADMIN_LOGIN_FAILURE_REASONS)[number];

export type AdminRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestPath?: string | null;
  requestMethod?: string | null;
  emailAttempted?: string | null;
};

type AdminSessionRecord = Awaited<ReturnType<typeof getSessionByTokenHash>>;

type ValidSessionResult = { ok: true; session: NonNullable<AdminSessionRecord> };
type InvalidSessionResult = { ok: false; failureReason: AdminLoginFailureReason; eventType?: AdminLoginEventType; session?: NonNullable<AdminSessionRecord> | null };
export type AdminSessionValidationResult = ValidSessionResult | InvalidSessionResult;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function addHours(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function serializeCookie(name: string, value: string, options: ReturnType<typeof getAdminCookieOptions>) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path}`, 'HttpOnly', `SameSite=${options.sameSite}`, `Max-Age=${options.maxAge}`];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

function parseCookieHeader(cookieHeader: string | null) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join('=')));
  }
  return cookies;
}

async function getSessionByTokenHash(tokenHash: string) {
  return prisma.adminSession.findUnique({
    where: { tokenHash },
    include: { adminUser: { select: { id: true, username: true, isActive: true } } },
  });
}

export function generateSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function getAdminCookieOptions(maxAge = ADMIN_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge,
    secure: isProduction(),
  };
}

export function createAdminSessionCookie(token: string) {
  return serializeCookie(SESSION_COOKIE, token, getAdminCookieOptions());
}

export function clearAdminSessionCookie() {
  return serializeCookie(SESSION_COOKIE, '', getAdminCookieOptions(0));
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || null;
}

export function getUserAgent(request: Request) {
  return request.headers.get('user-agent');
}

export function getRequestMetadata(request: Request, overrides: Partial<AdminRequestMetadata> = {}): AdminRequestMetadata {
  const url = new URL(request.url);
  return {
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
    requestPath: url.pathname,
    requestMethod: request.method,
    ...overrides,
  };
}

export function getAdminSessionTokenFromRequest(request: Request) {
  return parseCookieHeader(request.headers.get('cookie')).get(SESSION_COOKIE) || null;
}

export async function createAdminLoginLog(input: {
  adminUserId?: string | null;
  emailAttempted: string;
  eventType: AdminLoginEventType;
  result: AdminLoginResult;
  failureReason?: AdminLoginFailureReason | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  requestPath?: string | null;
  requestMethod?: string | null;
}) {
  return prisma.adminLoginLog.create({
    data: {
      adminUserId: input.adminUserId ?? null,
      emailAttempted: input.emailAttempted,
      eventType: input.eventType,
      result: input.result,
      failureReason: input.failureReason ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      sessionId: input.sessionId ?? null,
      requestPath: input.requestPath ?? null,
      requestMethod: input.requestMethod ?? null,
    },
  });
}

export async function createAdminSession(input: { adminUserId: string; token: string; ipAddress?: string | null; userAgent?: string | null; now?: Date }) {
  const now = input.now ?? new Date();
  return prisma.adminSession.create({
    data: {
      adminUserId: input.adminUserId,
      tokenHash: hashSessionToken(input.token),
      expiresAt: addHours(now, ADMIN_SESSION_MAX_AGE_SECONDS),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function validateAdminSessionToken(
  token: string | null | undefined,
  metadata: AdminRequestMetadata = {},
  options: { logInvalid?: boolean } = {},
): Promise<AdminSessionValidationResult> {
  if (!token) return { ok: false, failureReason: 'missing_cookie' };

  const tokenHash = hashSessionToken(token);
  const session = await getSessionByTokenHash(tokenHash);
  const emailAttempted = metadata.emailAttempted || session?.adminUser.username || '';

  if (!session) {
    if (options.logInvalid) {
      await createAdminLoginLog({ ...metadata, emailAttempted, eventType: 'invalid_session', result: 'fail', failureReason: 'invalid_session' });
    }
    return { ok: false, failureReason: 'invalid_session', eventType: 'invalid_session', session: null };
  }

  if (!session.adminUser.isActive) {
    if (options.logInvalid) {
      await createAdminLoginLog({ ...metadata, adminUserId: session.adminUserId, sessionId: session.id, emailAttempted, eventType: 'invalid_session', result: 'fail', failureReason: 'invalid_session' });
    }
    return { ok: false, failureReason: 'invalid_session', eventType: 'invalid_session', session };
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    if (options.logInvalid) {
      await createAdminLoginLog({ ...metadata, adminUserId: session.adminUserId, sessionId: session.id, emailAttempted, eventType: 'session_expired', result: 'fail', failureReason: 'expired_session' });
    }
    return { ok: false, failureReason: 'expired_session', eventType: 'session_expired', session };
  }

  if (session.revokedAt) {
    if (options.logInvalid) {
      await createAdminLoginLog({ ...metadata, adminUserId: session.adminUserId, sessionId: session.id, emailAttempted, eventType: 'session_revoked', result: 'fail', failureReason: 'revoked_session' });
    }
    return { ok: false, failureReason: 'revoked_session', eventType: 'session_revoked', session };
  }

  return { ok: true, session };
}

export async function getAdminSessionFromRequest(request: Request, options: { logInvalid?: boolean } = {}) {
  const metadata = getRequestMetadata(request);
  return validateAdminSessionToken(getAdminSessionTokenFromRequest(request), metadata, options);
}

export async function requireAdminSession(request: Request) {
  const result = await getAdminSessionFromRequest(request, { logInvalid: true });
  if (result.ok) return result;
  return { ok: false as const, response: Response.json({ error: 'Authentication required.' }, { status: 401 }) };
}

export async function revokeAdminSession(token: string | null | undefined, metadata: AdminRequestMetadata = {}) {
  if (!token) return { revoked: false, failureReason: 'missing_cookie' as const };
  const tokenHash = hashSessionToken(token);
  const session = await getSessionByTokenHash(tokenHash);
  const now = new Date();

  if (!session) {
    await createAdminLoginLog({ ...metadata, emailAttempted: metadata.emailAttempted || '', eventType: 'invalid_session', result: 'fail', failureReason: 'invalid_session' });
    return { revoked: false, failureReason: 'invalid_session' as const };
  }

  if (!session.revokedAt) {
    await prisma.adminSession.update({ where: { id: session.id }, data: { revokedAt: now } });
  }

  await createAdminLoginLog({
    ...metadata,
    adminUserId: session.adminUserId,
    emailAttempted: metadata.emailAttempted || session.adminUser.username,
    eventType: 'logout',
    result: 'success',
    sessionId: session.id,
  });

  return { revoked: true, sessionId: session.id };
}
