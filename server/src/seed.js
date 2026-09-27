// Veritabanını sıfırlar ve demo verisini yükler: `npm run seed`
import { rmSync } from 'node:fs';
import { bootstrap } from './bootstrap.js';
import { loadConfig } from './config.js';
import { openDatabase } from './database.js';
import { seedDemo } from './demo-data.js';

const config = loadConfig();
if (process.argv.includes('--reset') && config.dbPath !== ':memory:') {
  for (const suffix of ['', '-wal', '-shm']) rmSync(config.dbPath + suffix, { force: true });
}
const db = openDatabase(config.dbPath);
bootstrap(db, config);
seedDemo(db);
db.close();
console.log(`Demo verisi yüklendi: ${config.dbPath}`);
console.log('Giriş: admin@fimar.com.tr / ik@fimar.com.tr / yonetici@fimar.com.tr / personel@fimar.com.tr — şifre: Demo1234');
