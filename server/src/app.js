import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.js';

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

  app.use('/api', createApi(db, config));

  // Üretimde derlenmiş istemciyi (client/dist) sun; SPA yönlendirmeleri index.html'e düşer.
  const dist = config.clientDist ?? resolve(here, '../../client/dist');
  if (existsSync(join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
  }

  return app;
}
