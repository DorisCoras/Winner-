// İlk kurulum: izin türleri, resmi tatiller, bordro parametreleri, holding kaydı ve yönetici hesabı.
import { hashPassword } from './auth.js';
import { getSetting, setSetting, transaction } from './db.js';
import { DEFAULT_HOLIDAYS, DEFAULT_LEAVE_TYPES } from './lib/constants.js';
import { DEFAULT_PAYROLL_PARAMS } from './lib/payroll.js';

export function bootstrap(db, { adminEmail, adminPassword, log = console.log } = {}) {
  if (getSetting(db, 'initialized') === '1') return false;
  transaction(db, () => {
    const lt = db.prepare(
      `INSERT OR IGNORE INTO leave_types (code, name, deducts_balance, paid, max_days, color, sort)
       VALUES (:code, :name, :deducts_balance, :paid, :max_days, :color, :sort)`,
    );
    for (const t of DEFAULT_LEAVE_TYPES) lt.run(t);

    const hol = db.prepare('INSERT OR IGNORE INTO holidays (date, name, half_day) VALUES (?, ?, ?)');
    for (const [date, name, half] of DEFAULT_HOLIDAYS) hol.run(date, name, half);

    const pp = db.prepare('INSERT OR IGNORE INTO payroll_params (year, data) VALUES (?, ?)');
    for (const [year, data] of Object.entries(DEFAULT_PAYROLL_PARAMS)) pp.run(Number(year), JSON.stringify(data));

    if (!db.prepare('SELECT 1 FROM companies LIMIT 1').get()) {
      db.prepare("INSERT INTO companies (name, short_name, is_holding) VALUES ('FIMAR Holding A.Ş.', 'FIMAR Holding', 1)").run();
    }

    if (!db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get()) {
      db.prepare('INSERT INTO users (email, password_hash, role, must_change_password) VALUES (?, ?, ?, 1)').run(
        adminEmail,
        hashPassword(adminPassword),
        'admin',
      );
      log(`Yönetici hesabı oluşturuldu: ${adminEmail} (ilk girişte şifre değiştirilmelidir)`);
    }
    setSetting(db, 'initialized', '1');
  });
  return true;
}
