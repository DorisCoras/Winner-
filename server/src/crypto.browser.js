// Tarayıcı demo sürümü için crypto.js karşılığı. Veriler yalnızca kullanıcının tarayıcısında
// tutulduğundan şifreler basit bir özetle saklanır; gerçek sunucu scrypt kullanır.

function fnv1a(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export const sha256Hex = (s) => [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map((seed) => fnv1a(String(s), seed)).join('');

export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export const randomToken = (bytes = 32) =>
  Array.from(randomBytes(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

export const hashPassword = (password) => `demo$${sha256Hex(password)}`;

export const verifyPassword = (password, stored) => stored === hashPassword(password);
