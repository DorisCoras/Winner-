-- FIMAR İK veritabanı şeması (SQLite)

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS companies (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  short_name  TEXT,
  is_holding  INTEGER NOT NULL DEFAULT 0,
  tax_office  TEXT,
  tax_no      TEXT,
  sgk_no      TEXT,
  address     TEXT,
  phone       TEXT,
  email       TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id          INTEGER PRIMARY KEY,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  manager_id  INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS employees (
  id                INTEGER PRIMARY KEY,
  sicil_no          TEXT NOT NULL UNIQUE,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  tc_kimlik         TEXT UNIQUE,
  email             TEXT,
  phone             TEXT,
  birth_date        TEXT,
  gender            TEXT CHECK (gender IN ('K', 'E') OR gender IS NULL),
  marital_status    TEXT,
  blood_type        TEXT,
  education         TEXT,
  address           TEXT,
  city              TEXT,
  emergency_contact TEXT,
  emergency_phone   TEXT,
  company_id        INTEGER NOT NULL REFERENCES companies(id),
  department_id     INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  position          TEXT,
  manager_id        INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  hire_date         TEXT NOT NULL,
  employment_type   TEXT NOT NULL DEFAULT 'tam_zamanli',
  gross_salary      REAL NOT NULL DEFAULT 0,
  iban              TEXT,
  sgk_no            TEXT,
  status            TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'ayrildi')),
  exit_date         TEXT,
  exit_code         TEXT,
  exit_note         TEXT,
  leave_carryover   REAL NOT NULL DEFAULT 0,
  leave_base_date   TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);

CREATE TABLE IF NOT EXISTS users (
  id                    INTEGER PRIMARY KEY,
  email                 TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('admin', 'ik', 'yonetici', 'personel')),
  employee_id           INTEGER UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
  active                INTEGER NOT NULL DEFAULT 1,
  must_change_password  INTEGER NOT NULL DEFAULT 0,
  last_login_at         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leave_types (
  id               INTEGER PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  deducts_balance  INTEGER NOT NULL DEFAULT 0,
  paid             INTEGER NOT NULL DEFAULT 1,
  max_days         REAL,
  color            TEXT NOT NULL DEFAULT '#2563eb',
  active           INTEGER NOT NULL DEFAULT 1,
  sort             INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id             INTEGER PRIMARY KEY,
  employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id  INTEGER NOT NULL REFERENCES leave_types(id),
  start_date     TEXT NOT NULL,
  end_date       TEXT NOT NULL,
  half_day       INTEGER NOT NULL DEFAULT 0,
  days           REAL NOT NULL,
  reason         TEXT,
  status         TEXT NOT NULL DEFAULT 'beklemede'
                 CHECK (status IN ('beklemede', 'onaylandi', 'reddedildi', 'iptal')),
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at     TEXT,
  decision_note  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leaves_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_dates ON leave_requests(start_date, end_date);

CREATE TABLE IF NOT EXISTS holidays (
  date      TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  half_day  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payroll_params (
  year  INTEGER PRIMARY KEY,
  data  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id           INTEGER PRIMARY KEY,
  company_id   INTEGER NOT NULL REFERENCES companies(id),
  year         INTEGER NOT NULL,
  month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  status       TEXT NOT NULL DEFAULT 'taslak' CHECK (status IN ('taslak', 'onaylandi')),
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, year, month)
);

CREATE TABLE IF NOT EXISTS payroll_items (
  id                      INTEGER PRIMARY KEY,
  run_id                  INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id             INTEGER NOT NULL REFERENCES employees(id),
  days                    INTEGER NOT NULL DEFAULT 30,
  base_gross              REAL NOT NULL,
  extra_gross             REAL NOT NULL DEFAULT 0,
  gross                   REAL NOT NULL,
  sgk_base                REAL NOT NULL,
  sgk_employee            REAL NOT NULL,
  unemployment_employee   REAL NOT NULL,
  income_tax_base         REAL NOT NULL,
  cumulative_base_before  REAL NOT NULL,
  income_tax_gross        REAL NOT NULL,
  income_tax_exemption    REAL NOT NULL,
  income_tax              REAL NOT NULL,
  stamp_tax_gross         REAL NOT NULL,
  stamp_tax_exemption     REAL NOT NULL,
  stamp_tax               REAL NOT NULL,
  deductions              REAL NOT NULL DEFAULT 0,
  net                     REAL NOT NULL,
  sgk_employer            REAL NOT NULL,
  unemployment_employer   REAL NOT NULL,
  employer_cost           REAL NOT NULL,
  note                    TEXT,
  UNIQUE (run_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee ON payroll_items(employee_id);

CREATE TABLE IF NOT EXISTS job_postings (
  id               INTEGER PRIMARY KEY,
  company_id       INTEGER NOT NULL REFERENCES companies(id),
  department_id    INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  location         TEXT,
  employment_type  TEXT NOT NULL DEFAULT 'tam_zamanli',
  openings         INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'acik' CHECK (status IN ('acik', 'beklemede', 'kapali')),
  closes_at        TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS candidates (
  id           INTEGER PRIMARY KEY,
  posting_id   INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  source       TEXT,
  stage        TEXT NOT NULL DEFAULT 'basvuru'
               CHECK (stage IN ('basvuru', 'on_eleme', 'mulakat', 'teklif', 'ise_alindi', 'red')),
  rating       INTEGER CHECK (rating BETWEEN 1 AND 5 OR rating IS NULL),
  expected_salary REAL,
  notes        TEXT,
  employee_id  INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
  id          INTEGER PRIMARY KEY,
  category    TEXT NOT NULL,
  name        TEXT NOT NULL,
  serial_no   TEXT,
  status      TEXT NOT NULL DEFAULT 'depoda' CHECK (status IN ('depoda', 'zimmetli', 'arizali', 'hurda')),
  value       REAL,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS asset_assignments (
  id           INTEGER PRIMARY KEY,
  asset_id     INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_at  TEXT NOT NULL,
  returned_at  TEXT,
  notes        TEXT,
  return_notes TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_employee ON asset_assignments(employee_id);

CREATE TABLE IF NOT EXISTS announcements (
  id          INTEGER PRIMARY KEY,
  company_id  INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id               INTEGER PRIMARY KEY,
  employee_id      INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  period           TEXT NOT NULL,
  scores           TEXT NOT NULL DEFAULT '{}',
  overall          REAL,
  strengths        TEXT,
  improvements     TEXT,
  goals            TEXT,
  status           TEXT NOT NULL DEFAULT 'taslak' CHECK (status IN ('taslak', 'tamamlandi')),
  acknowledged_at  TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employee_documents (
  id             INTEGER PRIMARY KEY,
  employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type       TEXT NOT NULL,
  received_date  TEXT,
  expiry_date    TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (employee_id, doc_type)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   INTEGER,
  details     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
