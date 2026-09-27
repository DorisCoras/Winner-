import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth, sessionMiddleware } from './auth.js';
import { HttpError, errorHandler } from './http.js';
import adminRoutes from './routes/admin.js';
import assetRoutes from './routes/assets.js';
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import engagementRoutes from './routes/engagement.js';
import insightRoutes from './routes/insights.js';
import leaveRoutes from './routes/leaves.js';
import organizationRoutes from './routes/organization.js';
import payrollRoutes from './routes/payroll.js';
import recruitmentRoutes from './routes/recruitment.js';

const here = dirname(fileURLToPath(import.meta.url));

export function createApp(db, config) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  const api = express.Router();
  api.use(express.json({ limit: '1mb' }));
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  // CSRF koruması: çerez SameSite=Strict; ek olarak durum değiştiren isteklerde Origin denetlenir.
  api.use((req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (!origin || config.allowedOrigins.includes(origin)) return next();
    let host = null;
    try {
      host = new URL(origin).host;
    } catch {
      // "null" veya bozuk Origin başlığı → reddedilir
    }
    if (host !== req.headers.host) return next(new HttpError(403, 'Geçersiz istek kaynağı.'));
    next();
  });
  api.use(sessionMiddleware(db));

  api.use(authRoutes(db, config));
  api.use(requireAuth);
  api.use(organizationRoutes(db));
  api.use(employeeRoutes(db));
  api.use(leaveRoutes(db));
  api.use(payrollRoutes(db));
  api.use(recruitmentRoutes(db));
  api.use(assetRoutes(db));
  api.use(engagementRoutes(db));
  api.use(insightRoutes(db));
  api.use(adminRoutes(db));
  api.use((_req, _res, next) => next(new HttpError(404, 'API uç noktası bulunamadı.')));
  api.use(errorHandler);

  app.use('/api', api);

  // Üretimde derlenmiş istemciyi (client/dist) sun; SPA yönlendirmeleri index.html'e düşer.
  const dist = config.clientDist ?? resolve(here, '../../client/dist');
  if (existsSync(join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
  }

  return app;
}
