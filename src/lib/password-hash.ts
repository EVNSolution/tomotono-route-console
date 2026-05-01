import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const HASH_ALGORITHM = 'sha256';
const HASH_PREFIX = 'pbkdf2-sha256';
const HASH_ITERATIONS = 210_000;
const HASH_KEY_LENGTH = 32;

export function hashPassword(password: string, salt = randomBytes(16).toString('base64url')) {
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_ALGORITHM).toString('base64url');
  return `${HASH_PREFIX}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [prefix, iterationsText, salt, expectedHash] = storedHash.split('$');
  const iterations = Number(iterationsText);
  if (prefix !== HASH_PREFIX || !Number.isSafeInteger(iterations) || iterations <= 0 || !salt || !expectedHash) {
    return false;
  }

  const actual = Buffer.from(pbkdf2Sync(password, salt, iterations, HASH_KEY_LENGTH, HASH_ALGORITHM).toString('base64url'));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
