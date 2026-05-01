import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password-hash';

describe('admin password hashing', () => {
  it('verifies the password used to create the hash', () => {
    const hash = hashPassword('tomatono_admin1!', 'fixed-test-salt');
    expect(verifyPassword('tomatono_admin1!', hash)).toBe(true);
  });

  it('rejects incorrect passwords and malformed hashes', () => {
    const hash = hashPassword('tomatono_admin1!', 'fixed-test-salt');
    expect(verifyPassword('wrong-password', hash)).toBe(false);
    expect(verifyPassword('tomatono_admin1!', 'bad-hash')).toBe(false);
  });
});
