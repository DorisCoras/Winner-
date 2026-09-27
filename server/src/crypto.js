// Node.js şifreleme temel işlemleri. Tarayıcı demo sürümünde crypto.browser.js ile değiştirilir.
import { createHash, randomBytes as nodeRandomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEYLEN = 64;

export function hashPassword(password) {
  const salt = nodeRandomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

export const sha256Hex = (s) => createHash('sha256').update(s).digest('hex');

/** URL'de güvenle kullanılabilen rastgele belirteç. */
export const randomToken = (bytes = 32) => nodeRandomBytes(bytes).toString('base64url');

/** n adet 0–255 arası rastgele bayt. */
export const randomBytes = (n) => Uint8Array.from(nodeRandomBytes(n));
