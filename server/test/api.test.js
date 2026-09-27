import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { bootstrap } from '../src/bootstrap.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';
import { seedDemo } from '../src/seed.js';
import { addDays, today } from '../src/lib/dates.js';

let server;
let base;
let db;

before(async () => {
  const config = { ...loadConfig({}), dbPath: ':memory:', clientDist: '/nonexistent' };
  db = openDatabase(':memory:');
  bootstrap(db, { ...config, log: () => {} });
  seedDemo(db);
  server = createApp(db, config).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server?.close();
  db?.close();
});

async function login(email, password = 'Demo1234') {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `login ${email}`);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  return async (path, { method = 'GET', body } = {}) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json();
    return { status: r.status, data };
  };
}

test('oturum açmadan API erişimi engellenir', async () => {
  const res = await fetch(`${base}/employees`);
  assert.equal(res.status, 401);
  const meta = await (await fetch(`${base}/meta`)).json();
  assert.equal(meta.demo, true);
});

test('hatalı şifre 401 döner', async () => {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@fimar.com.tr', password: 'yanlis' }),
  });
  assert.equal(res.status, 401);
});

test('İK personel listesini maaşla görür, personel başkasının detayını göremez', async () => {
  const hr = await login('ik@fimar.com.tr');
  const list = await hr('/employees');
  assert.equal(list.status, 200);
  assert.ok(list.data.length > 40);
  assert.ok('gross_salary' in list.data[0]);

  const me = await login('personel@fimar.com.tr');
  const own = await me('/auth/me');
  const other = list.data.find((e) => e.id !== own.data.user.employee_id);
  assert.equal((await me(`/employees/${other.id}`)).status, 403);
  assert.equal((await me('/payroll/runs')).status, 403);
  const self = await me(`/employees/${own.data.user.employee_id}`);
  assert.equal(self.status, 200);
  assert.ok(self.data.tc_kimlik);
});

test('yönetici ekibini görür ama hassas alanlar gizlenir', async () => {
  const mgr = await login('yonetici@fimar.com.tr');
  const list = await mgr('/employees');
  assert.equal(list.status, 200);
  assert.ok(list.data.length >= 4 && list.data.length < 10);
  const member = list.data.find((e) => e.position === 'Yazılım Geliştirici');
  const detail = await mgr(`/employees/${member.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.gross_salary, undefined);
  assert.equal(detail.data.tc_kimlik, undefined);
});

test('personel ekleme doğrulamaları ve hesap oluşturma', async () => {
  const hr = await login('ik@fimar.com.tr');
  const lookups = (await hr('/lookups')).data;
  const bad = await hr('/employees', {
    method: 'POST',
    body: { sicil_no: 'T1', first_name: 'Test', last_name: 'Kişi', company_id: lookups.companies[0].id, hire_date: '2026-01-05', employment_type: 'tam_zamanli', gross_salary: 50000, tc_kimlik: '12345678901' },
  });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.fields.tc_kimlik);

  const ok = await hr('/employees', {
    method: 'POST',
    body: {
      sicil_no: 'T2', first_name: 'Deneme', last_name: 'Personel', company_id: lookups.companies[0].id,
      hire_date: '2026-01-05', employment_type: 'tam_zamanli', gross_salary: 50000, tc_kimlik: '10000000146',
      email: 'deneme.personel@fimar.com.tr', create_account: true, account_role: 'personel',
    },
  });
  assert.equal(ok.status, 201);
  assert.ok(ok.data.temp_password);
});

test('izin talebi → yönetici onayı akışı ve bakiye', async () => {
  const me = await login('personel@fimar.com.tr');
  const mgr = await login('yonetici@fimar.com.tr');
  const types = (await me('/leave-types')).data;
  const annual = types.find((t) => t.code === 'yillik');
  const before = (await me('/dashboard')).data.me.leave_balance;

  // Gelecek bir pazartesiden itibaren 2 gün
  let start = addDays(today(), 60);
  while (new Date(`${start}T00:00:00Z`).getUTCDay() !== 1) start = addDays(start, 1);
  const preview = await me('/leaves/preview', { method: 'POST', body: { leave_type_id: annual.id, start_date: start, end_date: addDays(start, 1) } });
  assert.equal(preview.status, 200);

  const created = await me('/leaves', { method: 'POST', body: { leave_type_id: annual.id, start_date: start, end_date: addDays(start, 1), reason: 'Test' } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.status, 'beklemede');

  const overlap = await me('/leaves', { method: 'POST', body: { leave_type_id: annual.id, start_date: start, end_date: start } });
  assert.equal(overlap.status, 409);

  // Personel kendi talebini onaylayamaz
  assert.equal((await me(`/leaves/${created.data.id}/approve`, { method: 'POST', body: {} })).status, 403);

  const approvals = await mgr('/leaves?scope=approvals');
  assert.ok(approvals.data.some((r) => r.id === created.data.id && r.can_decide));
  const approved = await mgr(`/leaves/${created.data.id}/approve`, { method: 'POST', body: { note: 'İyi tatiller' } });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.status, 'onaylandi');

  const after = (await me('/dashboard')).data.me.leave_balance;
  assert.equal(after.balance, before.balance - created.data.days);

  // Onaylı talep personel tarafından iptal edilemez
  assert.equal((await me(`/leaves/${created.data.id}/cancel`, { method: 'POST', body: {} })).status, 409);
});

test('bordro dönemi oluşturma, satır düzenleme ve onay', async () => {
  const hr = await login('ik@fimar.com.tr');
  const companies = (await hr('/companies')).data;
  const year = Number(today().slice(0, 4));
  const month = Number(today().slice(5, 7));
  const run = await hr('/payroll/runs', { method: 'POST', body: { company_id: companies[0].id, year, month } });
  assert.equal(run.status, 201, JSON.stringify(run.data));
  const dup = await hr('/payroll/runs', { method: 'POST', body: { company_id: companies[0].id, year, month } });
  assert.equal(dup.status, 409);

  const detail = await hr(`/payroll/runs/${run.data.id}`);
  assert.ok(detail.data.items.length > 5);
  const item = detail.data.items[0];
  assert.ok(item.cumulative_base_before > 0 || month === 1);
  const edited = await hr(`/payroll/runs/${run.data.id}/items/${item.id}`, {
    method: 'PUT',
    body: { days: 30, extra_gross: 10000, deductions: 500, note: 'Prim' },
  });
  assert.equal(edited.status, 200);
  assert.ok(edited.data.gross > item.gross);

  assert.equal((await hr(`/payroll/runs/${run.data.id}/approve`, { method: 'POST', body: {} })).status, 200);
  const locked = await hr(`/payroll/runs/${run.data.id}/items/${item.id}`, { method: 'PUT', body: { days: 30, extra_gross: 0, deductions: 0 } });
  assert.equal(locked.status, 409);
});

test('bordro hesaplayıcı ve personelin kendi pusulaları', async () => {
  const me = await login('personel@fimar.com.tr');
  const calc = await me('/payroll/calculate', { method: 'POST', body: { amount: 33030, mode: 'gross', year: 2026 } });
  assert.equal(calc.status, 200);
  assert.equal(calc.data.months[0].net, 28075.5);
  const slips = await me('/payroll/my-payslips');
  assert.equal(slips.status, 200);
  if (slips.data.length) {
    const one = await me(`/payroll/items/${slips.data[0].id}`);
    assert.equal(one.status, 200);
  }
});

test('zimmet: ata ve iade al', async () => {
  const hr = await login('ik@fimar.com.tr');
  const asset = await hr('/assets', { method: 'POST', body: { category: 'Telefon', name: 'Test Telefon', serial_no: 'X1' } });
  assert.equal(asset.status, 201);
  const emp = (await hr('/employees')).data[0];
  const assigned = await hr(`/assets/${asset.data.id}/assign`, { method: 'POST', body: { employee_id: emp.id } });
  assert.equal(assigned.status, 201);
  assert.equal((await hr(`/assets/${asset.data.id}/assign`, { method: 'POST', body: { employee_id: emp.id } })).status, 409);
  assert.equal((await hr(`/assets/${asset.data.id}/return`, { method: 'POST', body: {} })).status, 200);
});

test('raporlar ve gösterge paneli', async () => {
  const hr = await login('ik@fimar.com.tr');
  const dash = await hr('/dashboard');
  assert.equal(dash.status, 200);
  assert.ok(dash.data.hr.headcount > 40);
  for (const path of ['/reports/headcount', '/reports/turnover', '/reports/leave-usage', '/reports/payroll-cost']) {
    const r = await hr(path);
    assert.equal(r.status, 200, path);
  }
  const me = await login('personel@fimar.com.tr');
  assert.equal((await me('/reports/headcount')).status, 403);
});

test('yalnızca admin kullanıcı yönetebilir', async () => {
  const hr = await login('ik@fimar.com.tr');
  assert.equal((await hr('/users')).status, 403);
  const admin = await login('admin@fimar.com.tr');
  const users = await admin('/users');
  assert.equal(users.status, 200);
  assert.ok(users.data.length >= 4);
});

test('farklı origin ile durum değiştiren istek reddedilir', async () => {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://kotu-site.example' },
    body: JSON.stringify({ email: 'admin@fimar.com.tr', password: 'Demo1234' }),
  });
  assert.equal(res.status, 403);
});
