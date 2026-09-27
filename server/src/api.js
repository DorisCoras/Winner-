import express from 'express';
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

/**
 * Tüm /api uç noktalarını içeren router. Node sunucusu (app.js) ve tarayıcı demo sürümü
 * aynı ara katman zincirini kullanır.
 */
export function createApi(db, config) {
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
  return api;

}
