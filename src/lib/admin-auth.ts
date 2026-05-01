import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password-hash';

export async function findActiveAdminByIdentifier(identifier: string) {
  return prisma.adminUser.findUnique({ where: { username: identifier } });
}

export function verifyAdminPassword(password: string, passwordHash: string) {
  return verifyPassword(password, passwordHash);
}
