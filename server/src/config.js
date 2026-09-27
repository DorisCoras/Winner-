import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  return {
    port: Number(env.PORT) || 3000,
    host: env.HOST || '0.0.0.0',
    dbPath: env.DB_PATH || resolve(here, '../data/fimar-ik.db'),
    sessionDays: Number(env.SESSION_DAYS) || 7,
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : production,
    trustProxy: env.TRUST_PROXY === 'true',
    allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    adminEmail: env.ADMIN_EMAIL || 'admin@fimar.com.tr',
    adminPassword: env.ADMIN_PASSWORD || 'Fimar2026!',
    seedDemo: env.SEED_DEMO ? env.SEED_DEMO === 'true' : !production,
  };
}
