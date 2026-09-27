// Örnek (demo) veri üreticisi. Tüm kişi, şirket ve kimlik bilgileri kurgusaldır.
// Kullanım: `npm run seed` (veritabanını sıfırlar ve demo verisini yeniden yükler).
import { rmSync } from 'node:fs';
import { hashPassword } from './auth.js';
import { bootstrap } from './bootstrap.js';
import { loadConfig } from './config.js';
import { insertRow, openDatabase, setSetting, transaction } from './db.js';
import { DOCUMENT_TYPES } from './lib/constants.js';
import { addDays, addYears, fullYearsBetween, today } from './lib/dates.js';
import { entitlementHistory } from './lib/leave.js';
import { buildTrIban, completeTcKimlik } from './lib/validators.js';
import { computeLeaveDays, fillPayrollRun } from './services.js';

// Deterministik rastgele sayı üreteci (mulberry32) — her kurulumda aynı demo verisi.
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FEMALE = ['Zeynep', 'Elif', 'Ayşe', 'Fatma', 'Merve', 'Esra', 'Büşra', 'Deniz', 'Selin', 'Ebru', 'Gizem', 'Özlem', 'Seda', 'Burcu', 'Derya', 'Pınar', 'Canan', 'Sibel', 'Nur', 'Aslı', 'Gamze', 'Tuğba'];
const MALE = ['Mehmet', 'Mustafa', 'Ahmet', 'Ali', 'Hüseyin', 'Murat', 'Emre', 'Burak', 'Can', 'Kerem', 'Oğuz', 'Serkan', 'Onur', 'Tolga', 'Barış', 'Hakan', 'Cem', 'Umut', 'Volkan', 'Kaan', 'Eren', 'Selim'];
const SURNAMES = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat', 'Erdoğan', 'Güneş', 'Aksoy', 'Tekin', 'Korkmaz', 'Acar', 'Uçar', 'Bulut', 'Güler'];
const CITIES = ['İstanbul', 'İstanbul', 'İstanbul', 'Ankara', 'İzmir', 'Kocaeli', 'Bursa'];

const ascii = (s) =>
  s.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c]);

// Şirket → departman → [yönetici unvanı, maaş], [[personel unvanı, maaş aralığı], ...]
const ORG = [
  {
    key: 'holding',
    gm: ['Genel Müdür (CEO)', 360000],
    departments: [
      ['Yönetim', null, [['Yönetici Asistanı', [52000, 60000]]]],
      ['İnsan Kaynakları', ['İnsan Kaynakları Müdürü', 165000], [['İK Uzmanı', [62000, 72000]], ['Bordro Uzmanı', [60000, 70000]], ['İşe Alım Uzmanı', [55000, 65000]]]],
      ['Finans ve Muhasebe', ['Finans Müdürü', 175000], [['Muhasebe Uzmanı', [58000, 68000]], ['Mali İşler Uzmanı', [65000, 78000]], ['Muhasebe Sorumlusu', [80000, 92000]]]],
      ['Bilgi Teknolojileri', ['BT Müdürü', 170000], [['Sistem Yöneticisi', [75000, 90000]], ['BT Destek Uzmanı', [45000, 52000]]]],
      ['Hukuk', ['Hukuk Müşaviri', 160000], [['Avukat', [85000, 100000]]]],
    ],
  },
  {
    key: 'uretim',
    company: { name: 'Örnek Üretim A.Ş.', short_name: 'Örnek Üretim', tax_office: 'Gebze', address: 'Gebze OSB, Kocaeli' },
    gm: ['Genel Müdür', 240000],
    departments: [
      ['Üretim', ['Üretim Müdürü', 140000], [['Üretim Şefi', [70000, 80000]], ['Üretim Operatörü', [36000, 40000]], ['Üretim Operatörü', [36000, 40000]], ['Üretim Operatörü', [35000, 39000]], ['Bakım Teknisyeni', [45000, 52000]]]],
      ['Kalite Kontrol', ['Kalite Müdürü', 125000], [['Kalite Kontrol Uzmanı', [55000, 62000]], ['Kalite Kontrol Teknisyeni', [40000, 46000]]]],
      ['Satın Alma', ['Satın Alma Müdürü', 120000], [['Satın Alma Uzmanı', [55000, 65000]]]],
      ['Depo ve Lojistik', ['Depo Sorumlusu', 70000], [['Depo Personeli', [34000, 37000]], ['Forklift Operatörü', [38000, 42000]]]],
    ],
  },
  {
    key: 'lojistik',
    company: { name: 'Örnek Lojistik Ltd. Şti.', short_name: 'Örnek Lojistik', tax_office: 'Tuzla', address: 'Tuzla, İstanbul' },
    gm: ['Genel Müdür', 210000],
    departments: [
      ['Operasyon', ['Operasyon Müdürü', 130000], [['Operasyon Uzmanı', [52000, 60000]], ['Operasyon Uzmanı', [50000, 58000]]]],
      ['Filo Yönetimi', ['Filo Sorumlusu', 85000], [['Tır Şoförü', [48000, 55000]], ['Tır Şoförü', [48000, 55000]]]],
      ['Müşteri Hizmetleri', ['Müşteri Hizmetleri Yöneticisi', 90000], [['Müşteri Temsilcisi', [38000, 44000]], ['Müşteri Temsilcisi', [38000, 44000]]]],
    ],
  },
  {
    key: 'teknoloji',
    company: { name: 'Örnek Teknoloji A.Ş.', short_name: 'Örnek Teknoloji', tax_office: 'Sarıyer', address: 'Maslak, İstanbul' },
    gm: ['Genel Müdür', 260000],
    departments: [
      ['Yazılım Geliştirme', ['Yazılım Geliştirme Müdürü', 190000], [['Kıdemli Yazılım Geliştirici', [120000, 140000]], ['Yazılım Geliştirici', [80000, 95000]], ['Yazılım Geliştirici', [78000, 92000]], ['Test Uzmanı', [65000, 75000]]]],
      ['Ürün Yönetimi', ['Ürün Müdürü', 165000], [['Ürün Uzmanı', [80000, 95000]], ['UX Tasarımcı', [70000, 85000]]]],
      ['Satış ve Pazarlama', ['Satış ve Pazarlama Müdürü', 150000], [['Satış Temsilcisi', [55000, 65000]], ['Satış Temsilcisi', [52000, 62000]], ['Pazarlama Uzmanı', [58000, 68000]]]],
    ],
  },
];

export function seedDemo(db) {
  const rand = rng(20260927);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const roundTo = (n, step) => Math.round(n / step) * step;
  const now = today();
  const year = Number(now.slice(0, 4));
  const usedNames = new Set();
  let sicil = 0;
  let tcCounter = 0;

  const randomDate = (from, to) => addDays(from, between(0, Math.max(0, fullDays(from, to))));
  function fullDays(a, b) {
    return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  }

  function person(gender) {
    for (;;) {
      const first = pick(gender === 'K' ? FEMALE : MALE);
      const last = pick(SURNAMES);
      if (!usedNames.has(`${first} ${last}`)) {
        usedNames.add(`${first} ${last}`);
        return { first, last };
      }
    }
  }

  transaction(db, () => {
    setSetting(db, 'demo_mode', '1');

    // --- Şirketler ---
    const holdingId = db.prepare('SELECT id FROM companies WHERE is_holding = 1 LIMIT 1').get().id;
    db.prepare(
      `UPDATE companies SET tax_office = 'Beşiktaş', tax_no = '1234567890', sgk_no = '4.6201.01.01.1234567.034.12-34',
         address = 'Levent, Beşiktaş / İstanbul', phone = '0212 000 00 00', email = 'info@fimar.com.tr' WHERE id = ?`,
    ).run(holdingId);
    const companyIds = { holding: holdingId };
    for (const unit of ORG) {
      if (!unit.company) continue;
      companyIds[unit.key] = insertRow(db, 'companies', {
        ...unit.company,
        tax_no: String(between(1000000000, 9999999999)),
        phone: '0216 000 00 00',
      });
    }

    // --- Personel ---
    const employees = [];
    function addEmployee({ companyKey, departmentId, position, salary, managerId, level }) {
      const gender = rand() < 0.45 ? 'K' : 'E';
      const { first, last } = person(gender);
      // Kıdem: üst yönetim daha eski, operasyon personeli daha yeni.
      const maxYears = level === 'gm' ? 18 : level === 'manager' ? 14 : 9;
      const minYears = level === 'gm' ? 6 : level === 'manager' ? 3 : 0;
      const hire = randomDate(addYears(now, -maxYears), addDays(addYears(now, -minYears), -20));
      const age = between(Math.max(22, fullYearsBetween(hire, now) + 22), level === 'staff' ? 52 : 60);
      const birth = randomDate(addYears(now, -age - 1), addYears(now, -age));
      sicil += 1;
      tcCounter += 1;
      const tc = completeTcKimlik(String(100000000 + tcCounter * 7919).slice(0, 9));
      const row = {
        sicil_no: `FMR${String(sicil).padStart(5, '0')}`,
        first_name: first,
        last_name: last,
        tc_kimlik: tc,
        email: `${ascii(first)}.${ascii(last)}@fimar.com.tr`,
        phone: `05${between(30, 55)} ${between(100, 999)} ${between(10, 99)} ${between(10, 99)}`,
        birth_date: birth,
        gender,
        marital_status: pick(['Bekar', 'Evli', 'Evli', 'Evli']),
        blood_type: pick(['0 Rh+', 'A Rh+', 'A Rh+', 'B Rh+', 'AB Rh+', '0 Rh-', 'A Rh-']),
        education: level === 'staff' ? pick(['Lise', 'Ön Lisans', 'Lisans', 'Lisans']) : pick(['Lisans', 'Yüksek Lisans']),
        address: `${pick(['Atatürk', 'Cumhuriyet', 'İnönü', 'Fatih', 'Yeni'])} Mah. No: ${between(1, 120)}`,
        city: pick(CITIES),
        emergency_contact: `${pick([...FEMALE, ...MALE])} ${last} (${pick(['Eşi', 'Annesi', 'Babası', 'Kardeşi'])})`,
        emergency_phone: `05${between(30, 55)} ${between(100, 999)} ${between(10, 99)} ${between(10, 99)}`,
        company_id: companyIds[companyKey],
        department_id: departmentId,
        position,
        manager_id: managerId,
        hire_date: hire,
        employment_type: 'tam_zamanli',
        gross_salary: roundTo(salary, 500),
        iban: buildTrIban(`${pick(['00010', '00012', '00015', '00046', '00062', '00064', '00067'])}0${String(between(1e7, 9e7))}${String(between(1e7, 9e7))}`),
        sgk_no: String(between(1e12, 9e12)),
        leave_carryover: 0,
      };
      const id = insertRow(db, 'employees', row);
      const emp = { id, ...row, companyKey, level };
      employees.push(emp);
      return emp;
    }

    let ceo = null;
    const managers = {};
    for (const unit of ORG) {
      const deptIds = {};
      for (const [name] of unit.departments) {
        deptIds[name] = insertRow(db, 'departments', { company_id: companyIds[unit.key], name });
      }
      if (!deptIds['Yönetim']) {
        deptIds['Yönetim'] = insertRow(db, 'departments', { company_id: companyIds[unit.key], name: 'Yönetim' });
      }
      const gm = addEmployee({
        companyKey: unit.key,
        departmentId: deptIds['Yönetim'],
        position: unit.gm[0],
        salary: unit.gm[1],
        managerId: ceo?.id ?? null,
        level: 'gm',
      });
      if (!ceo) ceo = gm;
      db.prepare('UPDATE departments SET manager_id = ? WHERE id = ?').run(gm.id, deptIds['Yönetim']);

      for (const [name, head, staff] of unit.departments) {
        let manager = gm;
        if (head) {
          manager = addEmployee({
            companyKey: unit.key,
            departmentId: deptIds[name],
            position: head[0],
            salary: head[1] * (0.95 + rand() * 0.1),
            managerId: gm.id,
            level: 'manager',
          });
          db.prepare('UPDATE departments SET manager_id = ? WHERE id = ?').run(manager.id, deptIds[name]);
        }
        managers[name] = manager;
        for (const [title, [lo, hi]] of staff) {
          addEmployee({
            companyKey: unit.key,
            departmentId: deptIds[name],
            position: title,
            salary: between(lo, hi),
            managerId: manager.id,
            level: 'staff',
          });
        }
      }
    }

    // Bu yıl işe girenler (deneme süresi takibi için) ve ayrılanlar (devir oranı için).
    const recentHire = employees.find((e) => e.position === 'Müşteri Temsilcisi');
    const recentDate = addDays(now, -between(20, 45));
    db.prepare('UPDATE employees SET hire_date = ?, birth_date = ? WHERE id = ?').run(recentDate, '2000-04-12', recentHire.id);
    recentHire.hire_date = recentDate;

    const leavers = [
      ['Satış Temsilcisi', '03', 'Başka bir firmada iş teklifi aldı.'],
      ['Üretim Operatörü', '04', 'Üretim planlaması nedeniyle.'],
      ['Tır Şoförü', '12', 'Askerlik görevi.'],
    ];
    for (const [position, code, note] of leavers) {
      const emp = employees.find((e) => e.position === position && e.status !== 'ayrildi' && e.hire_date < `${year}-01-01`);
      if (!emp) continue;
      const exit = randomDate(`${year}-02-01`, addDays(now, -30));
      db.prepare("UPDATE employees SET status = 'ayrildi', exit_date = ?, exit_code = ?, exit_note = ? WHERE id = ?").run(exit, code, note, emp.id);
      emp.status = 'ayrildi';
      emp.exit_date = exit;
    }
    const active = employees.filter((e) => e.status !== 'ayrildi');

    // --- Kullanıcı hesapları ---
    const demoPassword = hashPassword('Demo1234');
    db.prepare("UPDATE users SET email = 'admin@fimar.com.tr', password_hash = ?, must_change_password = 0 WHERE role = 'admin'").run(demoPassword);
    const hrManager = managers['İnsan Kaynakları'];
    const devManager = managers['Yazılım Geliştirme'];
    const developer = active.find((e) => e.manager_id === devManager.id && e.position === 'Yazılım Geliştirici');
    // Demo personel hesabının anlamlı bir izin bakiyesi olsun (en az 2 yıllık kıdem).
    if (fullYearsBetween(developer.hire_date, now) < 2) {
      developer.hire_date = addDays(addYears(now, -3), -between(30, 200));
      db.prepare('UPDATE employees SET hire_date = ? WHERE id = ?').run(developer.hire_date, developer.id);
    }
    const addUser = (email, role, employeeId) =>
      db.prepare('INSERT INTO users (email, password_hash, role, employee_id) VALUES (?, ?, ?, ?)').run(email, demoPassword, role, employeeId);
    addUser('ik@fimar.com.tr', 'ik', hrManager.id);
    addUser('yonetici@fimar.com.tr', 'yonetici', devManager.id);
    addUser('personel@fimar.com.tr', 'personel', developer.id);
    // Diğer yöneticilere de (kendi e-postalarıyla) yönetici hesabı açılır.
    for (const m of new Set(Object.values(managers))) {
      if (m.id === devManager.id || m.id === hrManager.id) continue;
      addUser(m.email, 'yonetici', m.id);
    }
    const hrUserId = db.prepare("SELECT id FROM users WHERE email = 'ik@fimar.com.tr'").get().id;
    const mgrUserId = db.prepare("SELECT id FROM users WHERE email = 'yonetici@fimar.com.tr'").get().id;

    // --- İzinler ---
    const types = Object.fromEntries(db.prepare('SELECT code, id FROM leave_types').all().map((t) => [t.code, t.id]));
    const overlapStmt = db.prepare(
      "SELECT 1 FROM leave_requests WHERE employee_id = ? AND status IN ('beklemede', 'onaylandi') AND start_date <= ? AND end_date >= ?",
    );
    const addLeave = (emp, type, start, end, status, reason = null) => {
      const days = computeLeaveDays(db, start, end, 0);
      if (days <= 0 || overlapStmt.get(emp.id, end, start)) return 0;
      insertRow(db, 'leave_requests', {
        employee_id: emp.id,
        leave_type_id: types[type],
        start_date: start,
        end_date: end,
        days,
        reason,
        status,
        created_by: null,
        decided_by: status === 'beklemede' ? null : hrUserId,
        decided_at: status === 'beklemede' ? null : `${start} 09:00:00`,
      });
      return days;
    };
    const monday = (d) => {
      let x = d;
      while (new Date(`${x}T00:00:00Z`).getUTCDay() !== 1) x = addDays(x, 1);
      return x;
    };

    for (const emp of active) {
      const history = entitlementHistory(emp.hire_date, emp.birth_date, now);
      const earned = history.reduce((s, h) => s + h.days, 0);
      let used = 0;
      if (history.length) {
        // Yıl içinde 1–2 geçmiş yıllık izin.
        const count = between(1, 2);
        let cursor = `${year}-01-12`;
        for (let i = 0; i < count; i++) {
          const start = monday(randomDate(cursor, addDays(cursor, 70)));
          if (start >= addDays(now, -25)) break;
          const end = addDays(start, between(2, 9));
          used += addLeave(emp, 'yillik', start, end, 'onaylandi', pick(['Aile ziyareti', 'Tatil', 'Kişisel işler', null]));
          cursor = addDays(end, 30);
        }
        const target = emp.id === developer.id ? 16 : between(4, history.at(-1).days + 6);
        db.prepare('UPDATE employees SET leave_carryover = ? WHERE id = ?').run(target + used - earned, emp.id);
      }
    }

    // Bugün izinde olanlar, bekleyen talepler, rapor ve ücretsiz izin örnekleri.
    const others = active.filter((e) => ![developer.id, devManager.id, hrManager.id, ceo.id, recentHire.id].includes(e.id));
    const onLeave = [others[3], others[11], others[19]];
    for (const emp of onLeave) addLeave(emp, 'yillik', addDays(now, -2), addDays(now, between(3, 6)), 'onaylandi', 'Yıllık izin');
    addLeave(others[25], 'hastalik', addDays(now, -1), addDays(now, 2), 'onaylandi', 'Sağlık raporu');
    addLeave(others[7], 'ucretsiz', `${year}-${String(Math.max(1, Number(now.slice(5, 7)) - 2)).padStart(2, '0')}-10`, `${year}-${String(Math.max(1, Number(now.slice(5, 7)) - 2)).padStart(2, '0')}-14`, 'onaylandi', 'Kişisel nedenler');
    addLeave(others[14], 'mazeret', addDays(now, -20), addDays(now, -20), 'onaylandi', 'Taşınma');

    const team = active.filter((e) => e.manager_id === devManager.id);
    const future = monday(addDays(now, 12));
    addLeave(developer, 'yillik', future, addDays(future, 4), 'beklemede', 'Yıl sonu öncesi kısa tatil');
    addLeave(team.find((e) => e.id !== developer.id), 'yillik', addDays(future, 7), addDays(future, 11), 'beklemede', 'Aile ziyareti');
    addLeave(others[5], 'yillik', addDays(future, 14), addDays(future, 16), 'beklemede', 'Tatil');
    addLeave(others[22], 'mazeret', addDays(future, 2), addDays(future, 2), 'beklemede', 'Resmi daire işlemleri');
    addLeave(others[30], 'yillik', monday(addDays(now, 30)), addDays(monday(addDays(now, 30)), 4), 'onaylandi', 'Tatil');
    addLeave(others[9], 'yillik', addDays(future, 21), addDays(future, 25), 'reddedildi', 'Tatil');

    // --- Bordro: yılın geçmiş ayları, şirket bazında onaylı ---
    const currentMonth = Number(now.slice(5, 7));
    for (const key of Object.keys(companyIds)) {
      for (let m = 1; m < currentMonth; m++) {
        const runId = insertRow(db, 'payroll_runs', {
          company_id: companyIds[key],
          year,
          month: m,
          status: 'onaylandi',
          created_by: hrUserId,
          approved_by: hrUserId,
          approved_at: `${year}-${String(m).padStart(2, '0')}-28 17:00:00`,
        });
        const extras = new Map();
        // Haziran ve Aralık'ta ikramiye örneği.
        if (m === 6) {
          for (const e of employees.filter((x) => x.companyKey === key)) extras.set(e.id, { extra_gross: Math.round(e.gross_salary * 0.5), deductions: 0, note: 'Yarıyıl ikramiyesi' });
        }
        fillPayrollRun(db, runId, companyIds[key], year, m, extras);
      }
    }

    // --- Özlük belgeleri ---
    const docStmt = db.prepare('INSERT INTO employee_documents (employee_id, doc_type, received_date, expiry_date) VALUES (?, ?, ?, ?)');
    for (const emp of active) {
      for (const doc of DOCUMENT_TYPES) {
        const chance = doc.required ? 0.9 : 0.35;
        if (rand() > chance) continue;
        const received = addDays(emp.hire_date, between(-10, 5));
        let expiry = null;
        if (doc.code === 'saglik_raporu') expiry = rand() < 0.15 ? addDays(now, between(5, 40)) : addYears(received, 5) > now ? addYears(received, 5) : addDays(now, between(60, 700));
        if (doc.code === 'isg_egitimi') expiry = addDays(now, between(-20, 500));
        docStmt.run(emp.id, doc.code, received, expiry);
      }
    }

    // --- Zimmet ---
    const assetDefs = [
      ['Bilgisayar', 'Dell Latitude 5440', 12], ['Bilgisayar', 'Lenovo ThinkPad T14', 8], ['Bilgisayar', 'Apple MacBook Pro 14"', 4],
      ['Telefon', 'Samsung Galaxy S24', 6], ['Telefon', 'Apple iPhone 15', 4], ['Monitör', 'Dell P2723QE 27"', 6],
      ['Araç', 'Renault Clio 1.0 TCe', 2], ['Araç', 'Fiat Egea 1.4', 2], ['Tablet', 'Apple iPad 10. Nesil', 2],
      ['Kartvizit / Kart', 'Personel giriş kartı', 0], ['İş Kıyafeti', 'İş güvenliği ekipman seti', 5],
    ];
    const pool = [...active];
    let serial = 1000;
    for (const [category, name, count] of assetDefs) {
      for (let i = 0; i < count; i++) {
        serial += between(1, 40);
        const plate = category === 'Araç' ? `34 FMR ${String(between(100, 999))}` : null;
        const assetId = insertRow(db, 'assets', {
          category,
          name,
          serial_no: plate ?? `SN-${serial}`,
          status: 'depoda',
          value: category === 'Araç' ? between(900000, 1300000) : category === 'Bilgisayar' ? between(35000, 90000) : between(4000, 55000),
        });
        if (rand() < 0.8 && pool.length) {
          const emp = pool.splice(Math.floor(rand() * pool.length), 1)[0];
          insertRow(db, 'asset_assignments', { asset_id: assetId, employee_id: emp.id, assigned_at: addDays(emp.hire_date, between(0, 10)) });
          db.prepare("UPDATE assets SET status = 'zimmetli' WHERE id = ?").run(assetId);
        } else if (rand() < 0.15) {
          db.prepare("UPDATE assets SET status = 'arizali' WHERE id = ?").run(assetId);
        }
      }
    }
    // Geliştiricinin zimmetinde bilgisayar olsun (self-servis ekranı için).
    if (!db.prepare('SELECT 1 FROM asset_assignments WHERE employee_id = ?').get(developer.id)) {
      const assetId = insertRow(db, 'assets', { category: 'Bilgisayar', name: 'Apple MacBook Pro 14"', serial_no: 'SN-DEV-01', status: 'zimmetli', value: 85000 });
      insertRow(db, 'asset_assignments', { asset_id: assetId, employee_id: developer.id, assigned_at: developer.hire_date });
    }

    // --- İşe alım ---
    const jobs = [
      ['teknoloji', 'Yazılım Geliştirme', 'Kıdemli Frontend Geliştirici', 'acik', 2, 'React ve TypeScript ile kurumsal web uygulamaları geliştirecek, en az 5 yıl deneyimli takım arkadaşı.'],
      ['holding', 'İnsan Kaynakları', 'İK Uzmanı (İşe Alım)', 'acik', 1, 'Grup şirketlerinin işe alım süreçlerini uçtan uca yönetecek İK uzmanı.'],
      ['uretim', 'Kalite Kontrol', 'Kalite Kontrol Uzmanı', 'acik', 1, 'ISO 9001 süreçlerine hakim, tercihen endüstri/makine mühendisi.'],
      ['lojistik', 'Filo Yönetimi', 'Filo Operasyon Sorumlusu', 'beklemede', 1, 'Araç filosunun bakım, rota ve maliyet takibinden sorumlu.'],
      ['holding', 'Finans ve Muhasebe', 'Muhasebe Uzmanı', 'kapali', 1, 'Genel muhasebe ve vergi beyannameleri.'],
    ];
    const stages = ['basvuru', 'basvuru', 'on_eleme', 'mulakat', 'mulakat', 'teklif', 'red'];
    for (const [key, deptName, title, status, openings, description] of jobs) {
      const dept = db.prepare('SELECT id FROM departments WHERE company_id = ? AND name = ?').get(companyIds[key], deptName);
      const jobId = insertRow(db, 'job_postings', {
        company_id: companyIds[key],
        department_id: dept?.id ?? null,
        title,
        description,
        location: key === 'uretim' ? 'Kocaeli' : 'İstanbul',
        openings,
        status,
        closes_at: status === 'acik' ? addDays(now, between(10, 40)) : null,
      });
      const n = status === 'kapali' ? 3 : between(3, 7);
      for (let i = 0; i < n; i++) {
        const gender = rand() < 0.5 ? 'K' : 'E';
        const { first, last } = person(gender);
        const stage = status === 'kapali' ? (i === 0 ? 'ise_alindi' : 'red') : stages[i % stages.length];
        insertRow(db, 'candidates', {
          posting_id: jobId,
          first_name: first,
          last_name: last,
          email: `${ascii(first)}.${ascii(last)}@ornekmail.com`,
          phone: `05${between(30, 55)} ${between(100, 999)} ${between(10, 99)} ${between(10, 99)}`,
          source: pick(['Kariyer.net', 'LinkedIn', 'Referans', 'Şirket web sitesi']),
          stage,
          rating: stage === 'basvuru' ? null : between(2, 5),
          expected_salary: roundTo(between(50000, 140000), 1000),
          notes: stage === 'mulakat' ? 'Teknik mülakat planlandı.' : null,
        });
      }
    }

    // --- Duyurular ---
    const ann = (title, body, companyKey = null, pinned = 0, daysAgo = 0) =>
      insertRow(db, 'announcements', {
        company_id: companyKey ? companyIds[companyKey] : null,
        title,
        body,
        pinned,
        created_by: hrUserId,
        created_at: `${addDays(now, -daysAgo)} 10:00:00`,
      });
    ann('İK Portalımız yayında!', 'Değerli çalışma arkadaşlarımız,\n\nİzin taleplerinizi, bordro pusulalarınızı ve zimmet bilgilerinizi artık FIMAR İK portalı üzerinden takip edebilirsiniz. Sorularınız için İK birimimizle iletişime geçebilirsiniz.', null, 1, 12);
    ann('29 Ekim Cumhuriyet Bayramı', '28 Ekim öğleden sonra ve 29 Ekim tüm gün resmi tatildir. Cumhuriyet Bayramımız kutlu olsun!', null, 0, 3);
    ann('Yıl sonu izin planlaması', 'Yıllık izin bakiyelerinizi kontrol ederek yıl sonuna kadar kullanmayı planladığınız izinleri lütfen yöneticinizle paylaşınız.', null, 0, 6);
    ann('İş sağlığı ve güvenliği eğitimi', 'Tüm üretim personeli için periyodik İSG eğitimi önümüzdeki hafta Salı günü 09:00\'da eğitim salonunda yapılacaktır.', 'uretim', 0, 2);

    // --- Performans değerlendirmeleri ---
    const criteria = ['is_kalitesi', 'verimlilik', 'mesleki_bilgi', 'takim_calismasi', 'iletisim', 'inisiyatif', 'zaman_yonetimi'];
    for (const emp of active.filter((e) => e.hire_date < `${year - 1}-10-01`).slice(0, 26)) {
      const scores = Object.fromEntries(criteria.map((c) => [c, between(3, 5)]));
      const overall = Math.round((Object.values(scores).reduce((a, b) => a + b, 0) / criteria.length) * 100) / 100;
      insertRow(db, 'performance_reviews', {
        employee_id: emp.id,
        reviewer_id: emp.manager_id === devManager.id ? mgrUserId : hrUserId,
        period: `${year - 1} Yıl Sonu`,
        scores: JSON.stringify(scores),
        overall,
        strengths: pick(['Sorumluluk bilinci yüksek, işini zamanında teslim ediyor.', 'Takım içi iletişimi güçlü.', 'Teknik bilgisi ve öğrenme isteği yüksek.']),
        improvements: pick(['Önceliklendirme ve zaman yönetimi geliştirilebilir.', 'Sunum becerileri geliştirilebilir.', 'Dokümantasyon alışkanlığı artırılmalı.']),
        goals: pick(['Yeni sürecin kurulmasına liderlik etmek.', 'İlgili sertifika programını tamamlamak.', 'Ekip içi mentorluk yapmak.']),
        status: 'tamamlandi',
        acknowledged_at: rand() < 0.6 ? `${year}-01-${String(between(10, 28)).padStart(2, '0')} 11:00:00` : null,
        created_at: `${year}-01-05 10:00:00`,
        updated_at: `${year}-01-08 10:00:00`,
      });
    }
    for (const emp of team.slice(0, 2)) {
      insertRow(db, 'performance_reviews', {
        employee_id: emp.id,
        reviewer_id: mgrUserId,
        period: `${year} Ara Dönem`,
        scores: JSON.stringify({ is_kalitesi: 4, verimlilik: 4, mesleki_bilgi: 5 }),
        overall: 4.33,
        strengths: 'Sprint hedeflerine istikrarlı katkı.',
        status: 'taslak',
      });
    }
  });
}

// Doğrudan çalıştırıldığında: veritabanını sıfırla ve demo verisini yükle.
if (import.meta.url === `file://${process.argv[1]}`) {
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
}
