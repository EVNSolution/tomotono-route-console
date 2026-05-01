import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { hashPassword } from '@/lib/password-hash';
import { hashSessionToken, requireAdminSession, validateAdminSessionToken } from '@/lib/admin-session';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    adminUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminLoginLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const password = 'test-admin-password!';
const admin = {
  id: 'admin_1',
  username: 'tomotono_admin',
  passwordHash: hashPassword(password, 'fixed-test-salt'),
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
};

function loginRequest(body: Record<string, unknown>) {
  return new Request('https://tomatono.15.157.190.70.sslip.io/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vitest-agent',
      'x-forwarded-for': '203.0.113.10, 10.0.0.2',
    },
    body: JSON.stringify(body),
  });
}

function requestWithCookie(token?: string) {
  return new Request('https://tomatono.15.157.190.70.sslip.io/api/routes', {
    method: 'GET',
    headers: token
      ? {
          cookie: `tomotono_admin_session=${encodeURIComponent(token)}`,
          'user-agent': 'vitest-agent',
          'x-forwarded-for': '203.0.113.10',
        }
      : { 'user-agent': 'vitest-agent' },
  });
}

function sessionFor(token: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'session_1',
    adminUserId: admin.id,
    tokenHash: hashSessionToken(token),
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: null,
    userAgent: 'vitest-agent',
    ipAddress: '203.0.113.10',
    adminUser: { id: admin.id, username: admin.username, isActive: true },
    ...overrides,
  };
}

function cookieValue(response: Response) {
  const setCookie = response.headers.get('set-cookie') ?? '';
  return decodeURIComponent(setCookie.match(/tomotono_admin_session=([^;]*)/)?.[1] ?? '');
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NODE_ENV = 'test';
  let sessionCounter = 0;
  prismaMock.adminLoginLog.create.mockImplementation(async ({ data }) => ({ id: `log_${prismaMock.adminLoginLog.create.mock.calls.length}`, createdAt: new Date(), ...data }));
  prismaMock.adminUser.update.mockImplementation(async ({ where, data }) => ({ ...admin, ...where, ...data }));
  prismaMock.adminSession.create.mockImplementation(async ({ data }) => {
    sessionCounter += 1;
    return { id: `session_${sessionCounter}`, createdAt: new Date(), revokedAt: null, ...data };
  });
  prismaMock.adminSession.update.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
});

describe('admin login audit logging', () => {
  it('writes login_failed with user_not_found when the submitted admin identifier is unknown', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue(null);

    const response = await loginPost(loginRequest({ username: 'missing@example.com', password }));

    expect(response.status).toBe(401);
    expect(prismaMock.adminLoginLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: null,
        emailAttempted: 'missing@example.com',
        eventType: 'login_failed',
        result: 'fail',
        failureReason: 'user_not_found',
        ipAddress: '203.0.113.10',
        userAgent: 'vitest-agent',
        requestPath: '/api/auth/login',
        requestMethod: 'POST',
      }),
    });
    expect(JSON.stringify(prismaMock.adminLoginLog.create.mock.calls)).not.toContain(password);
  });

  it('writes login_failed with wrong_password when password validation fails', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue(admin);

    const response = await loginPost(loginRequest({ username: admin.username, password: 'wrong-password' }));

    expect(response.status).toBe(401);
    expect(prismaMock.adminLoginLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: admin.id,
        emailAttempted: admin.username,
        eventType: 'login_failed',
        result: 'fail',
        failureReason: 'wrong_password',
      }),
    });
    expect(JSON.stringify(prismaMock.adminLoginLog.create.mock.calls)).not.toContain('wrong-password');
  });

  it('creates a DB-backed AdminSession and login_success audit row without storing the raw token', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue(admin);

    const response = await loginPost(loginRequest({ username: admin.username, password }));
    const token = cookieValue(response);
    const createCall = prismaMock.adminSession.create.mock.calls[0][0];

    expect(response.status).toBe(200);
    expect(token).toHaveLength(43);
    expect(createCall.data).toMatchObject({
      adminUserId: admin.id,
      tokenHash: hashSessionToken(token),
      ipAddress: '203.0.113.10',
      userAgent: 'vitest-agent',
    });
    expect(createCall.data.tokenHash).not.toBe(token);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=28800');
    expect(response.headers.get('set-cookie')).not.toContain('Secure');
    expect(prismaMock.adminLoginLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: admin.id,
        emailAttempted: admin.username,
        eventType: 'login_success',
        result: 'success',
        failureReason: null,
        sessionId: 'session_1',
      }),
    });
    expect(JSON.stringify(prismaMock.adminSession.create.mock.calls)).not.toContain(token);
    expect(JSON.stringify(prismaMock.adminLoginLog.create.mock.calls)).not.toContain(token);
  });

  it('generates a different session token for each successful login', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue(admin);

    const first = await loginPost(loginRequest({ username: admin.username, password }));
    const second = await loginPost(loginRequest({ username: admin.username, password }));
    const firstToken = cookieValue(first);
    const secondToken = cookieValue(second);

    expect(firstToken).not.toBe(secondToken);
    expect(prismaMock.adminSession.create.mock.calls[0][0].data.tokenHash).not.toBe(prismaMock.adminSession.create.mock.calls[1][0].data.tokenHash);
  });

  it('adds the Secure cookie flag only in production', async () => {
    process.env.NODE_ENV = 'production';
    prismaMock.adminUser.findUnique.mockResolvedValue(admin);

    const response = await loginPost(loginRequest({ username: admin.username, password }));

    expect(response.headers.get('set-cookie')).toContain('Secure');
  });
});

describe('admin session validation', () => {
  it('allows a valid DB session to satisfy protected route authentication', async () => {
    const token = 'valid-session-token';
    prismaMock.adminSession.findUnique.mockResolvedValue(sessionFor(token));

    const result = await requireAdminSession(requestWithCookie(token));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.id).toBe('session_1');
  });

  it('rejects a missing session cookie without writing a noisy audit row', async () => {
    const result = await validateAdminSessionToken(null, { requestPath: '/api/routes', requestMethod: 'GET' }, { logInvalid: true });

    expect(result).toMatchObject({ ok: false, failureReason: 'missing_cookie' });
    expect(prismaMock.adminLoginLog.create).not.toHaveBeenCalled();
  });

  it('rejects and logs an invalid session token when the cookie has no DB match', async () => {
    prismaMock.adminSession.findUnique.mockResolvedValue(null);

    const result = await validateAdminSessionToken('invalid-token', { requestPath: '/api/routes', requestMethod: 'GET' }, { logInvalid: true });

    expect(result).toMatchObject({ ok: false, eventType: 'invalid_session', failureReason: 'invalid_session' });
    expect(prismaMock.adminLoginLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'invalid_session',
        result: 'fail',
        failureReason: 'invalid_session',
      }),
    });
  });

  it('rejects and logs an expired session', async () => {
    const token = 'expired-session-token';
    prismaMock.adminSession.findUnique.mockResolvedValue(sessionFor(token, { expiresAt: new Date(Date.now() - 1_000) }));

    const result = await validateAdminSessionToken(token, { requestPath: '/api/routes', requestMethod: 'GET' }, { logInvalid: true });

    expect(result).toMatchObject({ ok: false, eventType: 'session_expired', failureReason: 'expired_session' });
    expect(prismaMock.adminLoginLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: admin.id,
        sessionId: 'session_1',
        eventType: 'session_expired',
        result: 'fail',
        failureReason: 'expired_session',
      }),
    });
  });

  it('rejects and logs a revoked session', async () => {
    const token = 'revoked-session-token';
    prismaMock.adminSession.findUnique.mockResolvedValue(sessionFor(token, { revokedAt: new Date() }));

    const result = await validateAdminSessionToken(token, { requestPath: '/api/routes', requestMethod: 'GET' }, { logInvalid: true });

    expect(result).toMatchObject({ ok: false, eventType: 'session_revoked', failureReason: 'revoked_session' });
    expect(prismaMock.adminLoginLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: admin.id,
        sessionId: 'session_1',
        eventType: 'session_revoked',
        result: 'fail',
        failureReason: 'revoked_session',
      }),
    });
  });
});

describe('admin logout', () => {
  it('revokes the current AdminSession, clears the cookie, and writes a logout audit row', async () => {
    const token = 'logout-session-token';
    prismaMock.adminSession.findUnique.mockResolvedValue(sessionFor(token));

    const response = await logoutPost(
      new Request('https://tomatono.15.157.190.70.sslip.io/api/auth/logout', {
        method: 'POST',
        headers: {
          cookie: `tomotono_admin_session=${encodeURIComponent(token)}`,
          'user-agent': 'vitest-agent',
          'x-forwarded-for': '203.0.113.10',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.adminSession.update).toHaveBeenCalledWith({
      where: { id: 'session_1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prismaMock.adminLoginLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: admin.id,
        emailAttempted: admin.username,
        eventType: 'logout',
        result: 'success',
        sessionId: 'session_1',
      }),
    });
    expect(response.headers.get('set-cookie')).toContain('tomotono_admin_session=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(JSON.stringify(prismaMock.adminLoginLog.create.mock.calls)).not.toContain(token);
  });
});
