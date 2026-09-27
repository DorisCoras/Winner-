import { createApp } from './app.js';
import { bootstrap } from './bootstrap.js';
import { loadConfig } from './config.js';
import { openDatabase } from './database.js';
import { seedDemo } from './demo-data.js';

const config = loadConfig();
const db = openDatabase(config.dbPath);

if (bootstrap(db, config) && config.seedDemo) {
  seedDemo(db);
  console.log('Örnek (demo) veriler yüklendi. Canlı kullanımda SEED_DEMO=false ile başlatın.');
}

const app = createApp(db, config);
const server = app.listen(config.port, config.host, () => {
  console.log(`FIMAR İK çalışıyor: http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
