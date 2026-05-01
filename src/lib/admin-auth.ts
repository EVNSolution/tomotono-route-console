import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password-hash';

export async function authenticateAdminPassword(password: string) {
  const activeAdmins = await prisma.adminUser.findMany({ where: { isActive: true }, select: { id: true, passwordHash: true } });
  const matched = activeAdmins.find((admin) => verifyPassword(password, admin.passwordHash));
  if (!matched) return false;

  await prisma.adminUser.update({ where: { id: matched.id }, data: { lastLoginAt: new Date() } });
  return true;
}
